#!/usr/bin/env python3
"""Real stdio integration checks for shared config, concurrency, migration and packages."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import importlib.util
import json
import os
import platform
import tempfile
import subprocess

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('smoke', ROOT / 'scripts/test-vault-mcp.py')
smoke = importlib.util.module_from_spec(spec)
spec.loader.exec_module(smoke)
checks = 0

def check(condition, name):
    global checks
    if not condition:
        raise AssertionError(name)
    checks += 1
    print(f'[PASS] {name}', flush=True)

def initialize(command, environment):
    client = smoke.McpClient(command, environment)
    result = client.request('initialize', {'protocolVersion':'2024-11-05','capabilities':{},'clientInfo':{'name':'multi-host-integration','version':'1'}})
    client.notify('notifications/initialized')
    return client, result

def call(client, name, args):
    return client.request('tools/call', {'name':name,'arguments':args})

def state(client):
    return call(client,'get_vault_status',{})['structuredContent']

with tempfile.TemporaryDirectory(prefix='vault-multi-host-') as temporary:
    directory = Path(temporary).resolve()
    os.chdir(directory)
    vault = directory / 'vault'
    vault.mkdir()
    (vault / 'note.md').write_text('Original note')
    config = directory / 'config'
    config.mkdir()
    (config / '.vault-config.json').write_text(json.dumps({'vaultPath':str(vault),'retrievalRoots':['.'],'excludePaths':['.git'],'appPreferences':{'showHiddenFiles':False,'allowNoteEditing':True}}))
    environment = {**os.environ,'VAULT_MCP_CONFIG_DIR':str(config)}
    command = ['/bin/bash',str(ROOT/'scripts/start-vault-mcp.sh')]
    first, init = initialize(command, environment)
    second, _ = initialize(command, {**environment,'VAULT_MCP_HOST':'cursor'})
    try:
        tools = second.request('tools/list')['tools']
        check(all(not any(k.startswith('openai/') for k in tool.get('_meta',{})) for tool in tools),'cursor_uses_standard_metadata')
        check('openai/settings' in init['capabilities']['extensions'],'openai_settings_preserved')
        revision = state(first)['configRevision']
        with ThreadPoolExecutor(2) as pool:
            futures = [pool.submit(call, client, 'settings.update', {'configRevision':revision,'set':{'showHiddenFiles':True}}) for client in [first,second]]
            results = [future.result() for future in futures]
        check(sum(not result.get('isError',False) for result in results)==1,'concurrent_settings_reject_stale_revision')
        check(state(second)['appPreferences']['showHiddenFiles'],'preferences_shared_across_hosts')
        with ThreadPoolExecutor(2) as pool:
            futures=[pool.submit(call,client,'save_vault_note_from_app',{'path':'note.md','expectedContent':'Original note','content':content}) for client,content in [(first,'Host A'),(second,'Host B')]]
            results=[future.result() for future in futures]
        check(sum(not result.get('isError',False) for result in results)==1,'concurrent_editor_saves_preserve_conflict')
        next_vault=directory/'next-vault'
        next_vault.mkdir()
        (next_vault/'new.md').write_text('New vault')
        selected=call(second,'choose_vault',{'vaultPath':str(next_vault)})['structuredContent']['selection']
        check(state(first)['vaultPath']==str(vault),'explicit_path_selection_is_staged')
        connected=call(second,'connect_vault',{'selectionId':selected['selectionId'],'excludePaths':['.git']})
        check(not connected.get('isError'),'connect_second_host')
        check(state(first)['vaultPath']==str(next_vault),'running_host_refreshes_connection')
        check(call(first,'read_text_file',{'path':str(vault/'note.md')}).get('isError'),'old_vault_access_denied_after_switch')
        check(not call(first,'read_text_file',{'path':str(next_vault/'new.md')}).get('isError'),'new_vault_access_in_existing_host')
        staged=call(second,'choose_vault',{'vaultPath':str(vault)})['structuredContent']['selection']
        call(first,'settings.update',{'set':{'allowNoteEditing':False}})
        rejected=call(second,'connect_vault',{'selectionId':staged['selectionId'],'excludePaths':[]})
        check(rejected.get('isError'),'stale_folder_selection_rejected')
        check(state(second)['vaultPath']==str(next_vault),'stale_connect_preserves_connection')
        check(call(second,'write_file',{'path':str(next_vault/'denied.md'),'content':'blocked'}).get('isError'),'write_preference_enforced_in_other_host')
    finally:
        first.close()
        second.close()
    restarted,_=initialize(command,environment)
    try:
        check(state(restarted)['vaultPath']==str(next_vault),'shared_connection_survives_restart')
    finally: restarted.close()

    broken=directory/'broken-config'
    broken.mkdir()
    (broken/'.vault-config.json').write_text(json.dumps({'retrievalRoots':['.'],'excludePaths':['.git'],'revision':9,'appPreferences':{'showHiddenFiles':True,'allowNoteEditing':False}}))
    repair,_=initialize(command,{**environment,'VAULT_MCP_CONFIG_DIR':str(broken)})
    try:
        check(state(repair)['status']=='invalid','missing_legacy_path_has_repairable_status')
        selected=call(repair,'choose_vault',{'vaultPath':str(next_vault)})['structuredContent']['selection']
        connected=call(repair,'connect_vault',{'selectionId':selected['selectionId'],'excludePaths':['.git']})
        check(not connected.get('isError') and state(repair)['status']=='ready','missing_legacy_path_can_be_repaired')
        repaired=state(repair)
        check(repaired['configRevision']==10 and repaired['appPreferences']['allowNoteEditing'] is False and repaired['appPreferences']['showHiddenFiles'] is True,'repair_preserves_preferences_and_revision')
    finally: repair.close()
    # Migration uses an isolated HOME: the real user's config is never touched.
    home=directory/'home'
    legacy=home/'.codex/plugins/obsidian-vault-assistant'
    legacy.mkdir(parents=True)
    original={'retrievalRoots':['.'],'excludePaths':['.git','Private'],'appPreferences':{'showHiddenFiles':True,'allowNoteEditing':False}}
    (legacy/'.vault-config.json').write_text(json.dumps(original))
    (legacy/'.vault-path').write_text(str(vault))
    migration_env={**os.environ,'HOME':str(home),'CODEX_HOME':str(home/'.codex')}
    migration_env.pop('VAULT_MCP_CONFIG_DIR',None)
    migrated,_=initialize(command,migration_env)
    try:
        current=state(migrated)
        check(current['status']=='ready' and current['excludePaths']==original['excludePaths'] and current['appPreferences']==original['appPreferences'],'legacy_migration_preserves_scope_preferences')
        check(json.loads((legacy/'.vault-config.json').read_text())==original,'migration_keeps_legacy_file')
    finally: migrated.close()
    shared=home/'Library/Application Support/Obsidian Vault Assistant/.vault-config.json'
    saved=json.loads(shared.read_text())
    original['excludePaths'].append('NewLegacyExclusion')
    (legacy/'.vault-config.json').write_text(json.dumps(original))
    migrated,_=initialize(command,migration_env)
    try:
        check(bool(state(migrated)['configurationNotice']),'legacy_disagreement_visible')
        check(json.loads(shared.read_text())==saved,'existing_shared_config_has_priority')
    finally: migrated.close()
    # Simulate a process that crashed, leaving an expired library lock.
    lock=shared.parent/'.operation-lock'
    lock.mkdir()
    os.utime(lock,(1,1))
    recovered,_=initialize(command,migration_env)
    try: check(state(recovered)['status']=='ready','abandoned_lock_recovered')
    finally: recovered.close()

    architecture='arm64' if platform.machine()=='arm64' else 'x64'
    for host in ['openai','cursor','claude-desktop','claude-code','generic']:
        package=ROOT/'dist'/f'obsidian-vault-assistant-{host}-darwin-{architecture}'
        env={**environment,'PATH':'/usr/bin:/bin'}
        client,_=initialize(['/bin/bash',str(package/'scripts/launch-host.sh')],env)
        try:
            check(state(client)['status']=='ready',f'{host}_package_without_external_node_npm')
            check(not call(client,'read_text_file',{'path':str(next_vault/'new.md')}).get('isError'),f'{host}_packaged_read')
        finally: client.close()
    # The CLI uses exactly the same config store and validators as MCP setup.
    package=ROOT/'dist'/f'obsidian-vault-assistant-generic-darwin-{architecture}'
    before=json.loads((config/'.vault-config.json').read_text())
    configured=subprocess.run(['/bin/bash',str(package/'scripts/configure-vault.sh'),str(next_vault)],env={**environment,'PATH':'/usr/bin:/bin'},cwd='/',capture_output=True,text=True)
    check(configured.returncode==0,'packaged_cli_uses_bundled_runtime')
    after=json.loads((config/'.vault-config.json').read_text())
    check(after['appPreferences']==before['appPreferences'] and after['excludePaths']==before['excludePaths'] and after['retrievalRoots']==before['retrievalRoots'],'cli_preserves_scope_and_preferences')
    rejected=subprocess.run(['/bin/bash',str(package/'scripts/configure-vault.sh'),str(next_vault),'--exclude','private*'],env={**environment,'PATH':'/usr/bin:/bin'},cwd='/',capture_output=True,text=True)
    check(rejected.returncode!=0,'cli_rejects_glob_exclusions')
    check(json.loads((config/'.vault-config.json').read_text())==after,'cli_failure_preserves_connection')
    # Native archive extraction keeps the runtime executable; test extractor repair as well.
    package=ROOT/'dist'/f'obsidian-vault-assistant-claude-desktop-darwin-{architecture}'
    node=package/'runtime/bin/node'
    node.chmod(0o600)
    client,_=initialize(['/bin/bash',str(package/'scripts/launch-host.sh')],{**environment,'PATH':'/usr/bin:/bin'})
    try: check(state(client)['status']=='ready','mcpb_extractor_execute_bit_restored')
    finally: client.close()
print(f'Summary: {checks} multi-host integration checks passed')

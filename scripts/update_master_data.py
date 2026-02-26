import paramiko
import sys
import os
import json

host = 'ssh.lolipop.jp'
port = 2222
user = 'moo.jp-spin'
password = 'sKtzOYmbxVaocgKgZ1eYiE4BiWkIZsvI'

def run_remote_php(php_file_path):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(host, port=port, username=user, password=password)
        
        # SFTPでファイルをアップロード
        sftp = ssh.open_sftp()
        remote_path = 'web/api/dump_master.php'
        sftp.put(php_file_path, remote_path)
        sftp.close()
        
        # 実行 (php8.2 を指定)
        stdin, stdout, stderr = ssh.exec_command(f"php8.2 {remote_path}")
        out = stdout.read().decode('utf-8')
        err = stderr.read().decode('utf-8')
        
        # 削除
        ssh.exec_command(f"rm {remote_path}")
        
        ssh.close()
        return out, err
    except Exception as e:
        return "", str(e)

if __name__ == "__main__":
    out, err = run_remote_php('scripts/dump_master_data.php')
    if err:
        print("ERR:", err)
    else:
        try:
            # Check if output is valid JSON
            master_data = json.loads(out)
            # Re-format config from list to object if needed
            if isinstance(master_data.get('config'), list):
                new_config = {}
                for item in master_data['config']:
                    if 'config_key' in item and 'config_value' in item:
                        new_config[item['config_key']] = item['config_value']
                    elif 'name' in item and 'value' in item:
                        new_config[item['name']] = item['value']
                master_data['config'] = new_config
            
            with open('public/data/master_data.json', 'w', encoding='utf-8') as f:
                json.dump(master_data, f, ensure_ascii=False, indent=4)
            print("Successfully updated public/data/master_data.json")
        except Exception as e:
            print("FAILED to parse JSON or save file:", str(e))
            print("Raw Output Summary:", out[:200])

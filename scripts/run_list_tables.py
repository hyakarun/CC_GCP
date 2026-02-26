import paramiko
import sys
import os

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
        remote_path = 'web/api/list_tables_count.php'
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
    out, err = run_remote_php('scripts/list_tables_with_count.php')
    if err:
        print("ERR:", err)
    else:
        print("Tables:\n", out)

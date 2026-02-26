import paramiko
import sys

host = 'ssh.lolipop.jp'
port = 2222
user = 'moo.jp-spin'
password = 'sKtzOYmbxVaocgKgZ1eYiE4BiWkIZsvI'

php_dump_script = """<?php
require 'secrets.php';
$dsn = "mysql:host=$secret_db_host;dbname=$secret_db_name;charset=utf8mb4";
$pdo = new PDO($dsn, $secret_db_user, $secret_db_pass);
$stmt = $pdo->query("SELECT name, email, password, save_data FROM users");
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo json_encode(['users' => $users], JSON_UNESCAPED_UNICODE);
?>"""

def run_remote_command(command, input_data=None):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(host, port=port, username=user, password=password)
        if input_data:
            # ファイル書き込み
            sftp = ssh.open_sftp()
            with sftp.file('web/api/dump_script.php', 'w') as f:
                f.write(input_data)
            sftp.close()
            
            # 実行
            stdin, stdout, stderr = ssh.exec_command("php web/api/dump_script.php")
            out = stdout.read().decode('utf-8')
            err = stderr.read().decode('utf-8')
            
            # 削除
            ssh.exec_command("rm web/api/dump_script.php")
        else:
            stdin, stdout, stderr = ssh.exec_command(command)
            out = stdout.read().decode('utf-8')
            err = stderr.read().decode('utf-8')
        
        ssh.close()
        return out, err
    except Exception as e:
        return "", str(e)

if __name__ == "__main__":
    out, err = run_remote_command("", input_data=php_dump_script)
    if err:
        print("ERR:", err)
    else:
        with open('lolipop_dump.json', 'w', encoding='utf-8') as f:
            f.write(out)
        print("Successfully saved lolipop_dump.json")

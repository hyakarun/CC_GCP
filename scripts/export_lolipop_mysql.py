import paramiko
import sys
import os

host = 'ssh.lolipop.jp'
port = 2222
user = 'moo.jp-spin'
password = 'sKtzOYmbxVaocgKgZ1eYiE4BiWkIZsvI'

def run_remote_command(command):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(host, port=port, username=user, password=password)
        stdin, stdout, stderr = ssh.exec_command(command)
        out = stdout.read().decode('utf-8')
        err = stderr.read().decode('utf-8')
        ssh.close()
        return out, err
    except Exception as e:
        return "", str(e)

if __name__ == "__main__":
    mysql_cmd = "mysql -h mysql324.phy.lolipop.lan -u LAA1529361 -pnohomeru LAA1529361-ccplayer -e 'SELECT name, email, password, save_data FROM users' -B"
    out, err = run_remote_command(mysql_cmd)
    
    if err and "Using a password" not in err:
        print("REAL ERROR:", err)
    
    if out:
        with open('lolipop_dump.tsv', 'w', encoding='utf-8') as f:
            f.write(out)
        print(f"Successfully saved lolipop_dump.tsv ({len(out)} bytes)")
    else:
        print("No output received.")

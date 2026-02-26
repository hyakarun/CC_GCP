import paramiko
import sys

host = 'ssh.lolipop.jp'
port = 2222
user = 'moo.jp-spin'
password = 'sKtzOYmbxVaocgKgZ1eYiE4BiWkIZsvI'

def run_remote_command(command):
    print(f"Running remote command: {command}")
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
    out, err = run_remote_command("ls -R web")
    print(out)
    if err:
        print("ERR:", err)

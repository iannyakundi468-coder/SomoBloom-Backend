import os
import shutil
import subprocess

def blast_drizzle():
    drizzle_dir = "drizzle"
    if os.path.exists(drizzle_dir):
        for filename in os.listdir(drizzle_dir):
            if filename.endswith(".sql") and filename != "seed_data.sql":
                os.remove(os.path.join(drizzle_dir, filename))
        meta_dir = os.path.join(drizzle_dir, "meta")
        if os.path.exists(meta_dir):
            shutil.rmtree(meta_dir)

blast_drizzle()
result = subprocess.run(["npx", "drizzle-kit", "generate"], capture_output=True, text=True)
print(result.stdout)
if result.stderr:
    print("ERRORS:", result.stderr)

import os
os.system("cd '../SomoBloom Onboarding' && npm install > install.log 2>&1")
os.system("cd '../SomoBloom Onboarding' && npm run dev > dev.log 2>&1 &")
print("Started")

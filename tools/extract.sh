#!/bin/sh
# extract the page script to tools/g.js (for node checks and the simulation)
cd "$(dirname "$0")" && python3 -c "
import re;s=open('../gym.html').read();open('g.js','w').write(re.search(r'<script>(.*)</script>',s,re.S).group(1))" && node --check g.js && echo "g.js OK"

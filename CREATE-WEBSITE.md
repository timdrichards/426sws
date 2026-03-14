This is what I did to create a website using Quartz:

**Step #1: Clone Quartz Into New Website Vault**
```bash
git clone https://github.com/jackyzha0/quartz.git new-vault-website
cd new-vault-website
npm i
npx quartz create
> Empty Quartz
> Treat links as shortest path
```

**Step #2: Setup GitHub Repository**
Create a new GitHub repository (e.g., https://github.com/timdrichards/new-vault-website)
From the terminal new `new-vault-website`:
```bash
git remote -v           # to see remotes (optional)
git remote rm origin    # remove quartz origin repository

# add the new-vault-website as the origin
git remote add origin https://github.com/timdrichards/new-vault-website.git
git remove -v

# use quartz built-in git sync
npx quartz sync --no-pull
```

**Step #3: Setting Up Obsidian**
Copy `.obsidian` folder from other vault (optional, but makes prev settings available)
Create a template for creating note/page (optional)
Add a new test file in the `content` folder
Run Quartz locally:
```bash
npx quartz build --serve
# open browser at http://localhost:8080
```
Verify you can see this locally. 

**Step #4: Host Vault On GitHub Pages**
```bash
touch .github/workflows/deploy.yml
```
-> Copy the contents from [deploy.yml](https://quartz.jzhao.xyz/hosting#github-pages) to this new file.
-> Go to your GitHub repository: Settings > Pages > Source -> "GitHub Actions"
-> Go to GitHub repository: Settings > Environments > Deployment branches and tags > Add deployment branch or tag rule -> Add `v4` so that it allows GitHub to deploy from that branch.
```bash
npx quartz sync
```

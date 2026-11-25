# G21 Election Management and Voting System (EMVS)

Source code: https://github.com/WangDingzhuoya/G21_election_voting_system/tree/main/emvs_v1

A campus election website: administrators create elections and candidates, registered members vote once per election, and results are published after voting ends.

## How to Run

1. Install [Node.js](https://nodejs.org) (version 18 or above) and a MongoDB database (a local server or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster).
2. Open a terminal in the `emvs_v1` folder and install the dependencies:

   ```bash
   npm install
   ```

3. Set the database address. Either create a file `.env`-style export in your shell:

   ```bash
   # Windows (PowerShell)
   $env:MONGO_URI = "mongodb://127.0.0.1:27017/emvs"

   # macOS / Linux
   export MONGO_URI="mongodb://127.0.0.1:27017/emvs"
   ```

   Or edit the default value in `server.js`. If you use MongoDB Atlas, paste your own connection string (it starts with `mongodb+srv://`). See `.env.example` for a template.

4. Start the server:

   ```bash
   npm start
   ```

5. Open <http://localhost:8099> in a browser.

## How to Run the Tests

The end-to-end script starts the real server against a temporary in-memory MongoDB, drives the whole voting main chain over HTTP and checks 42 behaviours: the one-vote rule (409), the role checks (403), the closed-poll rule (FR13), the hidden counts while voting is open (FR22), the anonymity of the stored ballot (FR16), the tie rule (FR21) and that every page loads.

```bash
npm install
npm test
```

The script prints one line per check and ends with a summary, for example `42 passed, 0 failed`. It creates and removes its own temporary database, so it does not touch the data of a running server.

The first run downloads a temporary MongoDB binary for the test database (a few hundred MB, cached afterwards), so it needs a network connection once.

## What the System Does

- Register and log in with a hashed password; each account has a role (voter or administrator)
- Administrators create elections with a voting start and end time, and add candidates to each election
- The **Elections** page lists every election with its current status: coming soon, voting open, or closed
- Voters see all elections, and vote once in each open election
- A ballot is stored with a random ID and no voter information, so votes stay secret
- A unique record per voter per election blocks a second vote
- When voting ends, the results page shows the counted votes for each candidate
- Vote counts are only shown after the voting period closes
- If the candidates are level on the last seat, the result says a tie is required and nobody is elected (FR21)

## Demo Accounts

- **Administrator**: `admin@emvs.edu` / `admin1234` (created automatically at first startup)
- **Voter**: register your own account on the Register page

## Known Limitations (planned future work)

- No email verification, receipt codes, CSV roll import, audit log, or results export yet
- Single-seat elections only (one choice per ballot)
- Two roles only (voter and administrator); the auditor and system administrator roles are not built
- A tie is reported but not resolved: the election stays without an elected candidate until an administrator decides (FR21)

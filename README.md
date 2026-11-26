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

## Scope of This Release

This is the finished build of the project. It implements the voting main chain
end to end: accounts and roles, elections and candidates, one vote per member
per election, a secret ballot, and the result published after voting closes.

The boundary of that scope is stated here so that nothing is implied that the
build does not do:

- Two roles are implemented: voter and administrator. The auditor and system
  administrator roles are not part of this build.
- Elections are single-seat: one choice per ballot.
- A tie on the last seat is reported rather than resolved, so the election
  stays without an elected candidate until an administrator decides (FR21).
- Email verification, receipt codes, CSV roll import, audit logging and
  results export are not part of this build.

`REQUIREMENTS_STATUS.md` in this folder lists all 30 functional and all 15
non-functional requirements with the priority the group set and their status in
this build, so the boundary above can be checked against the specification.

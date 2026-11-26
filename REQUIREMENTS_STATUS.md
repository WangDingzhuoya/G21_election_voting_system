# Requirement status in this build

Every requirement of the EMVS specification, with the priority the group set
at specification time and its status in the code that is in the repository
now.

- **Built** — the requirement is fully implemented.
- **Partly** — the main behaviour is implemented, but the requirement is not
  met in full.
- **Not built** — the requirement is not implemented in this release.
- **Not verified** — a non-functional requirement that this build does not
  yet demonstrate by measurement.

Counts: **6 built, 11 partly built, 13 not built** of the thirty
functional requirements; **4 built, 6 partly built, 5 not verified**
of the fifteen non-functional requirements.

The same table is printed as Appendix A and Appendix B of the project
presentation.


## Functional requirements (FR01 – FR30)

| ID | Requirement | Priority | Status |
|---|---|---|---|
| FR01 | Activate an account with a password of at least 8 characters; the electoral roll is not checked yet | High | Partly |
| FR02 | Log in with email and password, open the home page for the role, log out | High | Built |
| FR03 | One role per account: Voter, Election Administrator, Auditor, System Administrator | High | Partly |
| FR04 | System Administrator creates staff accounts and changes their roles | Medium | Not built |
| FR05 | Email a 6-digit verification code during activation; it expires after 10 minutes | Medium | Not built |
| FR06 | Create an election: title, description, seats (K ≥ 1), start and end time | High | Partly |
| FR07 | Add, edit and delete candidates (name, optional photo, manifesto ≤ 1,000 characters) | High | Partly |
| FR08 | Import the electoral roll from a CSV file and report accepted and rejected rows | High | Not built |
| FR09 | Publish an election (Draft → Scheduled) only with a candidate and a non-empty roll | High | Not built |
| FR10 | Candidates, seats, voting period and roll cannot change once the election is Open | High | Partly |
| FR11 | Show a voter only the elections whose roll includes them, with status and period | High | Partly |
| FR12 | List the candidates in alphabetical order with their profiles | High | Partly |
| FR13 | Accept a ballot only in an open poll, inside the period, once per member | High | Partly |
| FR14 | Accept 1 to K different candidates per ballot and show a confirmation page first | High | Partly |
| FR15 | Save the ballot, the has-voted record and the audit entry together, or none of them | High | Partly |
| FR16 | Store ballots with no voter ID, account, IP address, time or sequential number | High | Built |
| FR17 | A submitted ballot can never be changed or withdrawn | High | Built |
| FR18 | Show a random receipt code after voting that anyone can check later | Medium | Not built |
| FR19 | Open the election at the start time and close it at the end time automatically | High | Built |
| FR20 | Administrator closes the election early with a reason that is logged | Medium | Not built |
| FR21 | Count the ballots automatically; the top K win; a tie is reported, not resolved | High | Built |
| FR22 | Show no vote counts to anyone while the election is Open | High | Built |
| FR23 | Show the Election Administrator the live turnout while the poll is open | Medium | Not built |
| FR24 | Publish the results: votes, percentage, winners, any tie, ballots cast and turnout | High | Partly |
| FR25 | Export the published results as a CSV file | Low | Not built |
| FR26 | Log every login, change, status change, count and publication, with user and time | High | Not built |
| FR27 | Nobody, not even a System Administrator, can edit or delete an audit entry | High | Not built |
| FR28 | An Auditor views the audit log and filters it by election, user and date | Medium | Not built |
| FR29 | An Auditor recounts the anonymous ballots and checks the result | Medium | Not built |
| FR30 | Delete the roll and the has-voted records after the retention period | Medium | Not built |

## Non-functional requirements (NFR01 – NFR15)

| ID | Requirement | Type | Priority | Status |
|---|---|---|---|---|
| NFR01 | Passwords are stored only as salted hashes, never as plain text | Product – Security | High | Built |
| NFR02 | The server checks the role on every staff function and denies the other roles | Product – Security | High | Built |
| NFR03 | No one, even an administrator with database access, can learn how a voter voted | Product – Security | High | Built |
| NFR04 | The account locks for 15 minutes after 5 failed logins; the session ends after 15 idle minutes | Product – Security | Medium | Partly |
| NFR05 | All traffic uses HTTPS anywhere other than a developer's own computer | Product – Security | Medium | Not verified |
| NFR06 | Text fields reject script and database commands without crashing | Product – Security | Medium | Partly |
| NFR07 | 1,000 ballot submissions including 50 repeats: 0 ballots lost and 0 duplicated | Product – Reliability | High | Not verified |
| NFR08 | After a restart every confirmed ballot is still stored and the service is back within 5 minutes | Product – Reliability | Medium | Partly |
| NFR09 | 95% of the page requests finish within 2 seconds with 200 voters online at once | Product – Performance | Medium | Not verified |
| NFR10 | Counting 10,000 ballots finishes within 10 seconds | Product – Performance | Medium | Not verified |
| NFR11 | A first-time voter logs in and votes within 3 minutes, checked with at least 5 test users | Product – Usability | Medium | Not verified |
| NFR12 | Works in Chrome, Edge, Safari and Firefox, on screens from 360 px upward | Product – Portability | Medium | Partly |
| NFR13 | GitHub repository with a README on how to install and run it; the link is the first line of the report | Organisational – Development | High | Partly |
| NFR14 | Personal data follows the Personal Data (Privacy) Ordinance Cap. 486: collect only what the election needs | External – Legislative | High | Partly |
| NFR15 | ACM/IEEE Code of Ethics: no hidden function collects personal data or affects a result | External – Ethical | High | Built |

## Why a requirement is only partly built

| Requirement | What is missing |
|---|---|
| FR01 | The member id and e-mail are not checked against an electoral roll — that is FR08 — and the eight-character password rule is only checked in the browser, not on the server. |
| FR03 | Two roles are implemented (Voter, Election Administrator). The Auditor and System Administrator roles are not. |
| FR06 | An election has a title, a description and a voting period, but no `seats` field, so every election has one seat. |
| FR07 | Candidates can be added, but not edited or deleted, and there is no photo upload. |
| FR10 | Nothing can be changed once an election is open — there are no edit functions at all — but the rule is not enforced by a check. |
| FR11 | Every member sees every election, because there is no roll to filter by. |
| FR12 | The candidates are not sorted alphabetically. |
| FR13 | The open period and the one-vote rule are enforced; the electoral roll is not checked. |
| FR14 | The confirmation page exists, but only one candidate can be chosen because every election has one seat. |
| FR15 | The ballot and the "has voted" record are saved together, with a compensating delete if the ballot insert fails, but there is no audit entry in the same save. |
| FR24 | The published result shows the votes, the percentage, the winner or the tie, and the number of ballots cast, but not the turnout. |

## Non-functional requirements that this build does not yet demonstrate

| Requirement | Why it is not verified |
|---|---|
| NFR04 | The fifteen-minute idle session timeout is implemented; the fifteen-minute lock after five failed logins is not. |
| NFR06 | Mongoose rejects malformed field values, but there is no explicit input sanitisation or an XSS test. |
| NFR08 | MongoDB persists the ballots, but no restart test has been run. |
| NFR12 | One responsive stylesheet covers the layout from 360 pixels upward; the four browsers have not been tested against each other. |
| NFR13 | The README is in the repository and the report starts with the repository link; the change still has to be pushed before the submission. |
| NFR14 | Only the member id, name and e-mail are collected, and the account lock is not in place; the retention job that deletes the roll after publication is FR30 and is not built. |

NFR05, NFR07, NFR09, NFR10 and NFR11 need measurement or an external
service (HTTPS in production, a load test, a counting benchmark, a usability
study) rather than code.

// End-to-end test for the EMVS build.
// It starts the server against a temporary in-memory MongoDB, drives the
// whole voting main chain over HTTP and checks 42 behaviours, including the
// one-vote rule (HTTP 409), the anonymity of the stored ballot (FR16) and
// the tie rule of FR21.
// Run with: npm test
const { MongoMemoryServer } = require('mongodb-memory-server');
const { spawn } = require('child_process');
const path = require('path');

const APP_DIR = path.join(__dirname, '..');
const BASE = 'http://localhost:8099';
const FORM = { 'content-type': 'application/x-www-form-urlencoded' };

const form = (obj) => new URLSearchParams(obj).toString();
let passed = 0;
let failed = 0;

function check(name, ok, extra) {
    if (ok) {
        passed++;
        console.log('PASS  ' + name);
    } else {
        failed++;
        console.log('FAIL  ' + name + (extra ? '  -> ' + extra : ''));
    }
}

function cookieOf(res) {
    const raw = res.headers.get('set-cookie');
    return raw ? raw.split(';')[0] : '';
}

async function waitForServer() {
    for (let i = 0; i < 60; i++) {
        try {
            await fetch(BASE + '/api/election-stats');
            return true;
        } catch (e) {
            await new Promise(r => setTimeout(r, 500));
        }
    }
    return false;
}

async function main() {
    const mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri('emvs');

    const server = spawn('node', ['server.js'], {
        cwd: APP_DIR,
        env: { ...process.env, MONGO_URI: uri }
    });
    server.stdout.on('data', d => process.stdout.write('[srv] ' + d));
    server.stderr.on('data', d => process.stdout.write('[err] ' + d));

    if (!await waitForServer()) {
        console.log('server did not start');
        process.exit(1);
    }
    await new Promise(r => setTimeout(r, 2000));

    let r;

    // --- 1. statistics endpoint ---
    r = await fetch(BASE + '/api/election-stats');
    const stats = await r.json();
    check('stats endpoint works', r.status === 200);
    check('stats has no vote count while open (FR22)', stats.votesCast === undefined, JSON.stringify(stats));

    // --- 2. election list starts empty ---
    r = await fetch(BASE + '/api/elections');
    const list0 = await r.json();
    check('election list starts empty', Array.isArray(list0) && list0.length === 0);

    // --- 3. admin login ---
    r = await fetch(BASE + '/login.html', {
        method: 'POST', redirect: 'manual', headers: FORM,
        body: form({ email: 'admin@emvs.edu', password: 'admin1234' })
    });
    const adminCookie = cookieOf(r);
    check('admin login redirects to elections', r.status === 302 && r.headers.get('location').includes('elections'), r.headers.get('location'));

    // --- 4. admin creates an open election ---
    const now = new Date();
    const openStart = new Date(now.getTime() - 60 * 60 * 1000);
    const openEnd = new Date(now.getTime() + 60 * 60 * 1000);
    r = await fetch(BASE + '/create-election.html', {
        method: 'POST', redirect: 'manual', headers: { ...FORM, cookie: adminCookie },
        body: form({ title: 'Open Election', description: 'running now', startAt: openStart.toISOString(), endAt: openEnd.toISOString() })
    });
    check('admin creates election', r.status === 302);

    // --- 5. non admin cannot create an election ---
    r = await fetch(BASE + '/register.html', {
        method: 'POST', headers: FORM,
        body: form({ fullName: 'Plain Voter', studentId: 'V100', email: 'voter@emvs.edu', department: 'cs', year: '2', password: 'pass1234', confirmPassword: 'pass1234' })
    });
    check('voter registers', r.status === 200);

    r = await fetch(BASE + '/login.html', {
        method: 'POST', redirect: 'manual', headers: FORM,
        body: form({ email: 'voter@emvs.edu', password: 'pass1234' })
    });
    const voterCookie = cookieOf(r);
    check('voter login works', r.status === 302 && voterCookie.length > 0);

    r = await fetch(BASE + '/create-election.html', {
        method: 'POST', redirect: 'manual', headers: { ...FORM, cookie: voterCookie },
        body: form({ title: 'Sneaky Election', startAt: openStart.toISOString(), endAt: openEnd.toISOString() })
    });
    check('voter blocked from creating an election (FR03/NFR02)', r.status === 403, 'status ' + r.status);

    // --- 6. candidate list after admin adds one ---
    r = await fetch(BASE + '/api/elections');
    const list = await r.json();
    const election = list.find(e => e.title === 'Open Election');
    check('created election appears in list', !!election);
    check('election status is open', election && election.status === 'open', election && election.status);

    r = await fetch(BASE + '/add-candidate.html', {
        method: 'POST', redirect: 'manual', headers: { ...FORM, cookie: adminCookie },
        body: form({ electionId: election.id, candidateName: 'Alice Johnson', studentId: 'C001', position: 'president', department: 'cs', slogan: 'Better campus', year: '3', groupName: 'Team A', biography: 'Longer library hours.', publish: 'yes' })
    });
    check('admin adds candidate', r.status === 302);

    r = await fetch(BASE + '/add-candidate.html', {
        method: 'POST', redirect: 'manual', headers: { ...FORM, cookie: voterCookie },
        body: form({ electionId: election.id, candidateName: 'Bad Candidate', studentId: 'C999', position: 'president', department: 'cs', publish: 'yes' })
    });
    check('voter blocked from adding a candidate (FR03/NFR02)', r.status === 403, 'status ' + r.status);

    r = await fetch(BASE + '/api/candidates?electionId=' + election.id, { headers: { cookie: adminCookie } });
    const candidates = await r.json();
    check('candidate list for the election has one candidate', candidates.length === 1, 'count ' + candidates.length);

    // --- 7. voting ---
    r = await fetch(BASE + '/vote.html', {
        method: 'POST', redirect: 'manual', headers: FORM,
        body: form({ electionId: election.id, candidateId: candidates[0]._id })
    });
    check('vote without login is sent back to the login page', r.status === 302, 'status ' + r.status);

    r = await fetch(BASE + '/vote.html', {
        method: 'POST', redirect: 'manual', headers: { ...FORM, cookie: voterCookie },
        body: form({ electionId: election.id, candidateId: candidates[0]._id })
    });
    check('vote is accepted', r.status === 200 && (await r.text()).includes('Vote Submitted'));

    r = await fetch(BASE + '/vote.html', {
        method: 'POST', redirect: 'manual', headers: { ...FORM, cookie: voterCookie },
        body: form({ electionId: election.id, candidateId: candidates[0]._id })
    });
    check('second vote is refused (409)', r.status === 409, 'status ' + r.status);

    // --- 8. no counts while the election is open (FR22) ---
    r = await fetch(BASE + '/api/elections/' + election.id);
    const openDetail = await r.json();
    check('no results while the election is open (FR22)', openDetail.results === undefined && openDetail.totalBallots === undefined);

    // --- 9. a closed election produces a result ---
    const pastStart = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const pastEnd = new Date(now.getTime() - 60 * 60 * 1000);
    r = await fetch(BASE + '/create-election.html', {
        method: 'POST', redirect: 'manual', headers: { ...FORM, cookie: adminCookie },
        body: form({ title: 'Closed Election', description: 'already over', startAt: pastStart.toISOString(), endAt: pastEnd.toISOString() })
    });
    check('admin creates a closed election', r.status === 302);

    r = await fetch(BASE + '/api/elections');
    const list2 = await r.json();
    const closed = list2.find(e => e.title === 'Closed Election');
    check('closed election has status closed', closed && closed.status === 'closed', closed && closed.status);

    r = await fetch(BASE + '/add-candidate.html', {
        method: 'POST', redirect: 'manual', headers: { ...FORM, cookie: adminCookie },
        body: form({ electionId: closed.id, candidateName: 'Bob Wong', studentId: 'C002', position: 'vice', department: 'business', slogan: 'Cheap food', year: '4', publish: 'yes' })
    });
    check('candidate added to the closed election', r.status === 302);

    r = await fetch(BASE + '/api/candidates?electionId=' + closed.id, { headers: { cookie: adminCookie } });
    const closedCandidates = await r.json();

    r = await fetch(BASE + '/vote.html', {
        method: 'POST', redirect: 'manual', headers: { ...FORM, cookie: voterCookie },
        body: form({ electionId: closed.id, candidateId: closedCandidates[0]._id })
    });
    check('vote in the closed election is refused (FR13)', r.status === 403, 'status ' + r.status);

    // the closed election refuses every ballot, so one is placed straight in the database
    const mongoose = require(path.join(APP_DIR, 'node_modules', 'mongoose'));
    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    await db.collection('ballots').insertOne({
        _id: require('crypto').randomUUID(),
        electionId: new mongoose.Types.ObjectId(closed.id),
        candidateId: new mongoose.Types.ObjectId(closedCandidates[0]._id)
    });
    await db.collection('participations').insertOne({
        electionId: new mongoose.Types.ObjectId(closed.id),
        studentId: 'V100',
        __v: 0
    });

    r = await fetch(BASE + '/api/elections/' + closed.id);
    const closedDetail = await r.json();
    check('closed election returns a result', !!closedDetail.results);
    check('result counts one ballot', closedDetail.totalBallots === 1, 'total ' + closedDetail.totalBallots);
    check('winner is the only candidate', closedDetail.winner === 'Bob Wong', 'winner ' + closedDetail.winner);

    // --- 10. the ballot itself must not carry a voter (FR16) ---
    const ballots = await db.collection('ballots').find({}).toArray();
    check('two ballots stored', ballots.length === 2, 'count ' + ballots.length);
    const ballot = ballots[0];
    const keys = Object.keys(ballot);
    check('ballot has no studentId (FR16)', !keys.includes('studentId'), keys.join(','));
    check('ballot has no createdAt or timestamp (FR16)', !keys.includes('createdAt') && !keys.includes('updatedAt'), keys.join(','));
    check('ballot id is a random uuid', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(ballot._id), ballot._id);

    const parts = await db.collection('participations').find({}).toArray();
    check('participation records who voted', parts.length === 2 && parts.every(p => !!p.studentId), 'count ' + parts.length);

    // --- 11. a tie for the last seat elects nobody (FR21) ---
    r = await fetch(BASE + '/create-election.html', {
        method: 'POST', redirect: 'manual', headers: { ...FORM, cookie: adminCookie },
        body: form({ title: 'Tie Election', description: 'two candidates with one vote each', startAt: pastStart.toISOString(), endAt: pastEnd.toISOString() })
    });
    check('admin creates a closed election for the tie case', r.status === 302);

    r = await fetch(BASE + '/api/elections');
    const list3 = await r.json();
    const tieElection = list3.find(e => e.title === 'Tie Election');
    check('tie election is closed', tieElection && tieElection.status === 'closed', tieElection && tieElection.status);

    for (const [name, sid] of [['Carol Chan', 'C003'], ['David Ho', 'C004']]) {
        r = await fetch(BASE + '/add-candidate.html', {
            method: 'POST', redirect: 'manual', headers: { ...FORM, cookie: adminCookie },
            body: form({ electionId: tieElection.id, candidateName: name, studentId: sid, position: 'member', department: 'science', slogan: 'slogan', year: '3', publish: 'yes' })
        });
        check('candidate ' + name + ' added to the tie election', r.status === 302);
    }

    r = await fetch(BASE + '/api/candidates?electionId=' + tieElection.id, { headers: { cookie: adminCookie } });
    const tieCandidates = await r.json();

    // one ballot for each candidate, so they are level on the single seat
    for (const candidate of tieCandidates) {
        await db.collection('ballots').insertOne({
            _id: require('crypto').randomUUID(),
            electionId: new mongoose.Types.ObjectId(tieElection.id),
            candidateId: new mongoose.Types.ObjectId(candidate._id)
        });
    }

    r = await fetch(BASE + '/api/elections/' + tieElection.id);
    const tieDetail = await r.json();
    check('the tied election reports a tie (FR21)', tieDetail.tie === true, 'tie ' + tieDetail.tie);
    check('nobody is elected when the last seat is tied (FR21)', tieDetail.winner === null, 'winner ' + tieDetail.winner);
    check('both tied candidates are counted (FR21)', tieDetail.results.length === 2 && tieDetail.results.every(c => c.votes === 1), JSON.stringify(tieDetail.results));

    // --- 12. pages are reachable ---
    for (const page of ['index.html', 'elections.html', 'results.html', 'add-candidate.html', 'register.html', 'login.html']) {
        const res = await fetch(BASE + '/' + page);
        check('page loads: ' + page, res.status === 200, 'status ' + res.status);
    }

    await mongoose.disconnect();
    server.kill();
    await mongod.stop();

    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });

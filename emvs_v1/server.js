const express = require('express');
const session = require('express-session');
const app = express();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");   //encryption
const crypto = require('crypto');
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/emvs'; //read the database address from the environment
const sessionSecret = 'qwerty';
const PORT = 8099;
const path = require('path');


mongoose.connect(mongoUri)
  .then(async () => {
    console.log('MongoDB connected via Mongoose');
    await createDefaultAdmin();
  })
  .catch((err) => console.error('MongoDB connection error:', err))
  .finally()

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 100 },
    studentId: { type: String, required: true, trim: true, unique: true, maxlength: 50 },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, maxlength: 254 },
    department: { type: String, required: true, trim: true, maxlength: 80 },
    year: { type: String, required: true, trim: true, maxlength: 10 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, default: 'voter' }   //one role per account: voter or admin
  },
  
  { timestamps: true } // add create time in mongodb
);

const candidateSchema = new mongoose.Schema({
    candidateName: {type: String, required: true},
    studentId: {type: String, required: true, unique: true},
    position: {type: String, required: true},
    department: {type: String, required: true},
    slogan: String,
    year: String,
    groupName: String,
    biography: String,
    photo: String,
    publish: {type: Boolean, default: false},
    electionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Election' }  //the election this candidate runs in
});

const Candidate = mongoose.model("Candidate", candidateSchema);

const User = mongoose.model("User", userSchema);

// An election holds the voting period and the candidates that run in it
const electionSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    createdBy: String
});

// Records that a student has voted in an election. The unique index refuses a second vote.
const participationSchema = new mongoose.Schema({
    electionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Election', required: true },
    studentId: { type: String, required: true }
});
participationSchema.index({ electionId: 1, studentId: 1 }, { unique: true });

// The ballot itself. It holds no voter id and no time, so it cannot be traced back to a voter.
const ballotSchema = new mongoose.Schema({
    _id: { type: String, default: () => crypto.randomUUID() },
    electionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Election', required: true },
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true }
});

const Election = mongoose.model("Election", electionSchema);
const Participation = mongoose.model("Participation", participationSchema);
const Ballot = mongoose.model("Ballot", ballotSchema);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        maxAge: 15 * 60 * 1000
    }
}));

// Create one administrator account at startup so the election flow can be demonstrated
async function createDefaultAdmin() {
    const exists = await User.findOne({ role: 'admin' });
    if (exists) return;

    try {
        await User.create({
            fullName: 'Election Administrator',
            studentId: 'ADMIN001',
            email: 'admin@emvs.edu',
            department: 'Administration',
            year: 'Staff',
            passwordHash: await bcrypt.hash('admin1234', 10),
            role: 'admin'
        });
        console.log('Default admin account created: admin@emvs.edu / admin1234');
    } catch (err) {
        console.log('Default admin account not created:', err.message);
    }
}

// Work out the state of an election from its voting period
function electionStatus(election) {
    const now = new Date();
    if (now < election.startAt) return 'upcoming';
    if (now > election.endAt) return 'closed';
    return 'open';
}

app.post('/register.html', async (req, res) => {
  try {
    const { fullName, studentId, email, department, year, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).send('Passwords do not match!');
    }

    if (!fullName || !studentId || !email || !department || !year || !password) {
      return res.status(400).send('Please fill in all required fields!');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    
    
    const user = new User({
      fullName,
      studentId,
      email,
      department,
      year,
      passwordHash
    });

    await user.save();

    res.send(`
    <h1>Registration Successful!</h1>
    <p>Your account has been created.</p>
    <button onclick="window.location.href='/login.html'">
        Go to Login
    </button>
`);

  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/login.html', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email })
            .select('+passwordHash');

        if (!user) {
            return res.status(404).send('User not found');
        }

        const match = await bcrypt.compare(
            password,
            user.passwordHash
        );

        if (!match) {
            return res.status(400).send('Wrong password');
        }

        // Save student information in session
        req.session.user = {
            studentId: user.studentId,
            fullName: user.fullName,
            role: user.role
        };

        // Each role opens its own home page
        res.redirect('/elections.html');

    } catch (err) {
        res.status(500).send('Login error');
    }
});

function requireLogin(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/login.html');
    }

    next();
}

// Middleware: only an Election Administrator can pass
function requireAdmin(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/login.html');
    }

    if (req.session.user.role !== 'admin') {
        return res.status(403).send('Access denied. This function is for election administrators.');
    }

    next();
}

 // Display voting page
app.get('/vote.html', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'vote.html'));
});

// Log out: clear the session and return to the home page
app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/index.html'));
});

// Tell the page who is logged in
app.get('/api/me', (req, res) => {
    res.json({
        loggedIn: !!req.session.user,
        fullName: req.session.user ? req.session.user.fullName : null,
        role: req.session.user ? req.session.user.role : null
    });
});

// Retrieve candidates from MongoDB
app.get('/api/candidates', requireLogin, async (req, res) => {
    try {
        // Only published candidates are shown, and only for the chosen election
        const filter = { publish: true };
        if (req.query.electionId) {
            filter.electionId = req.query.electionId;
        }

        const candidates = await Candidate.find(filter);

        res.json(candidates);
    } catch (err) {
        console.error('Error loading candidates:', err);
        res.status(500).json({
            message: 'Failed to load candidates.'
        });
    }
});

// List every election with its current state
app.get('/api/elections', async (req, res) => {
    try {
        const elections = await Election.find().sort({ startAt: -1 });

        const list = elections.map(election => ({
            id: election._id,
            title: election.title,
            description: election.description,
            startAt: election.startAt,
            endAt: election.endAt,
            status: electionStatus(election)
        }));

        res.json(list);
    } catch (err) {
        console.error('Error loading elections:', err);
        res.status(500).json({
            message: 'Failed to load the elections.'
        });
    }
});

// Give one election with its candidates. Vote counts are only sent after it closes.
app.get('/api/elections/:id', async (req, res) => {
    try {
        const election = await Election.findById(req.params.id);

        if (!election) {
            return res.status(404).json({ message: 'Election not found.' });
        }

        const status = electionStatus(election);
        const candidates = await Candidate.find({ electionId: election._id });

        const data = {
            election: {
                id: election._id,
                title: election.title,
                description: election.description,
                startAt: election.startAt,
                endAt: election.endAt
            },
            status: status,
            candidates: candidates.map(candidate => ({
                id: candidate._id,
                name: candidate.candidateName,
                position: candidate.position,
                department: candidate.department,
                slogan: candidate.slogan,
                biography: candidate.biography,
                groupName: candidate.groupName
            }))
        };

        // The result is only calculated once the voting period is over
        if (status === 'closed') {
            const ballots = await Ballot.find({ electionId: election._id });

            const tally = {};
            ballots.forEach(ballot => {
                tally[ballot.candidateId] = (tally[ballot.candidateId] || 0) + 1;
            });

            const results = data.candidates.map(candidate => ({
                name: candidate.name,
                votes: tally[candidate.id] || 0
            })).sort((a, b) => b.votes - a.votes);

            const top = results.length ? results[0].votes : 0;
            const tied = results.filter(result => result.votes === top);

            data.results = results;
            data.totalBallots = ballots.length;
            data.winner = (ballots.length > 0 && tied.length === 1) ? tied[0].name : null;
            data.tie = (ballots.length > 0 && tied.length > 1);
        }

        res.json(data);
    } catch (err) {
        console.error('Error loading election:', err);
        res.status(500).json({
            message: 'Failed to load the election.'
        });
    }
});

app.post('/vote.html', requireLogin, async (req, res) => {
    try {
        const { electionId, candidateId } = req.body;
        const studentId = req.session.user.studentId;

        // The election must exist and the voting period must be open
        const election = await Election.findById(electionId);

        if (!election) {
            return res.status(404).send('Election not found');
        }

        if (electionStatus(election) !== 'open') {
            return res.status(403).send('Voting is not open for this election');
        }

        // The chosen candidate must run in this election
        const candidate = await Candidate.findOne({
            _id: candidateId,
            electionId: election._id
        });

        if (!candidate) {
            return res.status(400).send('Invalid choice');
        }

        // Step 1: mark that this student has voted. The unique index refuses a second vote.
        try {
            await Participation.create({
                electionId: election._id,
                studentId: studentId
            });
        } catch (err) {
            return res.status(409).send('You have already voted in this election');
        }

        // Step 2: store the anonymous ballot
        try {
            await Ballot.create({
                electionId: election._id,
                candidateId: candidate._id
            });
        } catch (err) {
            // The ballot failed, so remove the participation record and let the student try again
            await Participation.deleteOne({
                electionId: election._id,
                studentId: studentId
            });

            return res.status(500).send('Unable to store your vote, please try again');
        }

        res.send(`
            <h1>Vote Submitted Successfully!</h1>
            <p>Thank you for voting. Your ballot is secret and cannot be linked to you.</p>

            <button onclick="window.location.href='/elections.html'">
                Back to Elections
            </button>
        `);

    } catch (err) {

        if (err.code === 11000) {
            return res.status(409).send('You have already voted in this election');
        }

        console.error(err);
        res.status(500).send('Unable to submit vote');
    }
});

// Create an election with its voting period
app.post('/create-election.html', requireAdmin, async (req, res) => {
    try {
        const { title, description, startAt, endAt } = req.body;

        if (!title || !startAt || !endAt) {
            return res.status(400).send('Please fill in the title and the voting period.');
        }

        if (new Date(endAt) <= new Date(startAt)) {
            return res.status(400).send('The closing time must be after the opening time.');
        }

        await Election.create({
            title,
            description,
            startAt,
            endAt,
            createdBy: req.session.user.studentId
        });

        res.redirect('/elections.html');

    } catch (err) {
        console.error(err);
        res.status(500).send('Unable to create the election');
    }
});

app.post('/add-candidate.html', requireAdmin, async (req, res) => {
    try {
        const {
            candidateName,
            studentId,
            position,
            department,
            slogan,
            year,
            groupName,
            biography,
            photo,
            publish,
            electionId
        } = req.body;

        if (!candidateName || !studentId || !position || !department || !electionId) {
            return res.status(400).send('Please fill in the name, student ID, position, department and election.');
        }

        // The candidate must run in an election that exists
        const election = await Election.findById(electionId);

        if (!election) {
            return res.status(400).send('The chosen election does not exist.');
        }

        const candidate = new Candidate({
            candidateName,
            studentId,
            position,
            department,
            slogan,
            year,
            groupName,
            biography,
            photo,
            publish: publish === 'yes',
            electionId: election._id
        });

        await candidate.save();

        res.redirect('/elections.html');

    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.use(express.static('public'));

// Get live election statistics
app.get('/api/election-stats', async (req, res) => {
    try {
        // Count registered students
        const registeredVoters = await User.countDocuments();

        // Count published candidates
        const candidates = await Candidate.countDocuments({
            publish: true
        });

        // Count the elections that are running right now
        const now = new Date();
        const openElections = await Election.countDocuments({
            startAt: { $lte: now },
            endAt: { $gte: now }
        });

        // Days left until the next election closes
        const nextElection = await Election.findOne({ endAt: { $gte: now } }).sort({ endAt: 1 });
        const daysLeft = nextElection
            ? Math.max(0, Math.ceil((nextElection.endAt - now) / (1000 * 60 * 60 * 24)))
            : 0;

        // Send the statistics to the frontend
        res.json({
            registeredVoters,
            candidates,
            daysLeft,
            openElections
        });

    } catch (err) {
        console.error('Error loading election statistics:', err);

        res.status(500).json({
            message: 'Unable to load election statistics.'
        });
    }
});

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) {
    return next(error);
  }

  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500
    ? error.status
    : 500;
  const message = status < 500 ? error.message : "An unexpected server error occurred.";
  return res.status(status).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

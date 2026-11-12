const express = require('express');
const app = express();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");   //encryption
const mongoUri = 'mongodb+srv://harry:harry@cluster0.4zcytsg.mongodb.net/'; //input the mongodb uri for mongoose

app.use(express.static('public'));

mongoose.connect(mongoUri)
  .then(() => console.log('MongoDB connected via Mongoose'))
  .catch((err) => console.error('MongoDB connection error:', err))
  .finally()

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 100 },
    studentId: { type: String, required: true, trim: true, unique: true, maxlength: 50 },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, maxlength: 254 },
    department: { type: String, required: true, trim: true, maxlength: 80 },
    year: { type: String, required: true, trim: true, maxlength: 10 },
    passwordHash: { type: String, required: true, select: false }
  },
  
  { timestamps: true } // add create time in mongodb
);

const candidateSchema = new mongoose.Schema({
    candidateName: {
        type: String,
        required: true
    },
    studentId: {
        type: String,
        required: true,
        unique: true
    },
    position: {
        type: String,
        required: true
    },
    department: {
        type: String,
        required: true
    },
    slogan: String,
    year: String,
    groupName: String,
    biography: String,
    photo: String,
    publish: String
});

const Candidate = mongoose.model("Candidate", candidateSchema);

const User = mongoose.model("User", userSchema);

app.use(express.json());// convert login info
app.use(express.urlencoded({ extended: true }));

app.post('/register.html', async (req, res) => {
  try {
    const { fullName, studentId, email, department, year, password } = req.body;

    const passwordHash = await bcrypt.hash(password, 10);
    
    if (!fullName || !studentId || !email || !department || !year || !password) {
    return res.status(400).send('Please fill in all fields');
}
    
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
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+passwordHash');

  if (!user) {
    return res.send('User not found');
  }

  const match = await bcrypt.compare(password, user.passwordHash);

  if (!match) {
    return res.send('Wrong password');
  }

  res.redirect('/vote.html');
});

app.post('/vote.html', async (req, res) => {

    const candidate = req.body.candidate;

    console.log("Vote received:", candidate);

    res.send(`
        <h1>Vote Submitted Successfully!</h1>

        <button onclick="window.location.href='/index.html'">
            Return to Home Page
        </button>
    `);
});

app.post('/add-candidate.html', async (req, res) => {
    try {
    
    	console.log(req.body);
    
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
            publish
        } = req.body;
        
        console.log("candidateName =", candidateName);

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
            publish
        });

        await candidate.save();

        res.send(`
            <h1>Candidate Added Successfully!</h1>
            <button onclick="window.location.href='/index.html'">
                Return Home
            </button>
        `);

    } catch (err) {
        res.status(500).send(err.message);
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

const PORT = process.env.PORT || 8099;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});



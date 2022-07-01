import express from 'express';

const app = express();

app.use(express.static('.'));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}...`);
});
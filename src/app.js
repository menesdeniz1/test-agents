const express = require('express');
const app = express();

app.use(express.json());

app.use('/notes', require('./notes'));
app.use('/tags', require('./tags'));
app.use('/search', require('./search'));
app.use('/export', require('./export'));

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => console.log(`listening on ${PORT}`));
}

module.exports = app;

const express = require('express');
const app = express();
app.get('/',(request,response) => response.send('working'));
app.listen(8080,() => console.log('listening'));
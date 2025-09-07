const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'", "'unsafe-inline'"],
            "style-src": ["'self'", "'unsafe-inline'"],
            "img-src": ["'self'", 'data:'],
        },
    },
}));
app.use(compression());
app.use(morgan('dev'));

app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',
    extensions: ['html']
}));

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`GWCL Bill Calculator running on http://localhost:${PORT}`);
});



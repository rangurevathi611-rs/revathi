export function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: 'Files must be 25 MB or smaller' });
    return;
  }

  if (err.message && err.message.startsWith('Only pdf')) {
    res.status(400).json({ error: err.message });
    return;
  }

  if (err.status) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  if (err.name === 'CastError') {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }

  if (err.code === 11000) {
    res.status(409).json({ error: 'That record already exists' });
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
}

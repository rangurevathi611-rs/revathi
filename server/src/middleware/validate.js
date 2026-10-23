export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues[0]?.message || 'Invalid request';
      return res.status(400).json({ error: message });
    }
    req.body = result.data;
    next();
  };
}

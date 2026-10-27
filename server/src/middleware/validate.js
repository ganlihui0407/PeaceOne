export function validateBody(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request' });
      return;
    }
    req.validatedBody = parsed.data;
    next();
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request' });
      return;
    }
    req.validatedQuery = parsed.data;
    next();
  };
}

export function validateParams(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request' });
      return;
    }
    req.validatedParams = parsed.data;
    next();
  };
}

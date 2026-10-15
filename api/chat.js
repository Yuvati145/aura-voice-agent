const { handleChat } = require('../lib/agent');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try { res.status(200).json(await handleChat(req.body || {})); }
  catch (e) { res.status(500).json({ error: e.message }); }
};

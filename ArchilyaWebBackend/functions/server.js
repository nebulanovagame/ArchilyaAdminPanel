const { app } = require('./src/app');
const { startAiStudioWorker } = require('./src/ai-jobs/worker');

const port = Number(process.env.PORT || 8080);

app.listen(port, () => {
  console.info(`[archilya-backend] Express API listening on ${port}`);
  startAiStudioWorker();
});

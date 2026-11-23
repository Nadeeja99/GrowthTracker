// Runs the fake OpenAI server on its own, for end-to-end tests and local UI
// work without an API key:
//   npx ts-node --transpile-only tests/fake-openai-server.ts   (port 5100)
// then start the API with OPENAI_API_KEY=sk-fake-... and
// OPENAI_BASE_URL=http://127.0.0.1:5100/v1.
import { startFakeOpenAI } from './fake-openai';
import { fakeReply } from './fake-openai-replies';

const port = Number(process.env.FAKE_OPENAI_PORT ?? 5100);

startFakeOpenAI(port).then(fake => {
  fake.script = fakeReply;
  console.log(`Fake OpenAI listening on ${fake.url}`);
});

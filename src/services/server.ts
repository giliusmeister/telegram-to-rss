import cors from 'cors';
import express, { type RequestHandler } from 'express';

const app = express();
const PORT = +process.env.PORT || 4444;

app.use(cors());
app.use(express.static('public'));

export const use = (path: string, handler: RequestHandler) => {
  app.use(path, handler);
};

export const get = (path: string, handler: RequestHandler) => {
  app.get(path, handler);
};

export const launch = () => {
  app.listen(PORT, () => {
    console.log('[SERVER] Express Server is now running on', PORT);
  });
};

import { ServerRequest } from "https://deno.land/std@0.97.0/http/server.ts";
import { Image } from "https://deno.land/x/imagescript@1.2.6/mod.ts";

const __filename = new URL(".", import.meta.url).pathname;
const RESOURCE_ROOT = `${__filename}`;

export default async (req: ServerRequest) => {
  const binary = await Deno.readFile(`${RESOURCE_ROOT}/base.png`);
  const font = await Deno.readFile(`${RESOURCE_ROOT}/Roboto-Regular.ttf`);
  const image = await Image.decode(binary);
  const helloText = Image.renderText(font, 120, "hello", 0xffffffff);
  image.composite(helloText, 30, 100);

  const encoded = await image.encode(1);

  const headers = new Headers();
  headers.set('Content-Type', 'image/png');

  req.respond({
    status: 200,
    headers,
    body: encoded,
  });
};

import { ServerRequest } from "https://deno.land/std@0.97.0/http/server.ts";
import { Image } from "https://deno.land/x/imagescript@1.2.6/mod.ts";
// TODO: remove this line, that released this commit:
//       https://github.com/matmen/ImageScript/commit/62eebb315f07f59e76f5b5fb00a1e54fb42b8052
import { TextLayout } from "https://github.com/hhatto/ImageScript/raw/deno-export-textlayout/mod.ts";

const __filename = new URL(".", import.meta.url).pathname;
const RESOURCE_ROOT = `${__filename}`;

const MARKET_GITHUB = "0x34A7AdC94C4D41C3e3469F98033B372cB2fAf318";
const MARKET_NPM = "0x88c7B1f41DdE50efFc25541a2E0769B887eB2ee7";

const DEVPROTOCOL_GRAPHQL_URL = "https://api.devprotocol.xyz/v1/graphql";
const DEVPROTOCOL_PROPERTY_URL = "https://api.devprotocol.xyz/v1/property";
const DEVPROTOCOL_FOR_APPS_URL = "https://dev-for-apps.azureedge.net";

const getPropertyInfo = async (propertyAddress: string) => {
  const body = `{
    "operationName": "getPropertyAuthentication",
    "variables": {
      "propertyAddress": "${propertyAddress}"
    },
    "query": "query getPropertyAuthentication($propertyAddress: String!) { property_authentication(where: { property: {_eq: $propertyAddress} }) { authentication_id market property_meta { author __typename } __typename }}"
  }`;
  const res = await fetch(DEVPROTOCOL_GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body,
  }).then((res) => res.json());
  const propertyName = res?.data.property_authentication[0].authentication_id;
  const authorAddress =
    res?.data.property_authentication[0].property_meta.author;
  const marketAddress = res?.data.property_authentication[0].market;
  return {
    propertyName,
    authorAddress,
    marketAddress,
  };
};

const getAuthorInfo = async (propertyAddress: string) => {
  const url = `${DEVPROTOCOL_PROPERTY_URL}/${propertyAddress}`;
  const res = await fetch(url).then((res) => res.json());
  const name = res.name;
  const karma = res.author.karma;
  return {
    name,
    karma,
  };
};

const getPropertyDetail = async (propertyAddress: string) => {
  const url =
    `${DEVPROTOCOL_FOR_APPS_URL}/properties?address=${propertyAddress}`;
  const res = await fetch(url).then((res) => res.json());
  const description = res[0].description || "";
  return { description };
};

export default async (req: ServerRequest) => {
  const base = `${req.headers.get("x-forwarded-proto")}://${
    req.headers.get(
      "x-forwarded-host",
    )
  }`;
  const url = new URL(req.url, base);

  const propertyAddress = url.searchParams.get("address");
  if (!propertyAddress?.startsWith("0x") || !propertyAddress) {
    req.respond({
      status: 400,
    });
    return;
  }
  console.debug(req.url, url, propertyAddress);

  const binary = await Deno.readFile(`${RESOURCE_ROOT}/base.png`);
  const font = await Deno.readFile(`${RESOURCE_ROOT}/Roboto-Regular.ttf`);
  const boldFont = await Deno.readFile(`${RESOURCE_ROOT}/Roboto-Bold.ttf`);
  const image = await Image.decode(binary);

  const res = await Promise.all([
    getPropertyInfo(propertyAddress),
    getAuthorInfo(propertyAddress),
    getPropertyDetail(propertyAddress),
  ]);
  const propertyName = res[0].propertyName;
  const marketAddress = res[0].marketAddress;
  const authorName = res[1].name;
  const karma = res[1].karma;
  const description = res[2].description;

  const market = marketAddress === MARKET_GITHUB
    ? "GitHub"
    : marketAddress === MARKET_NPM
    ? "npm"
    : "Creators";

  // render text
  const propertyNameText = Image.renderText(
    boldFont,
    60,
    propertyName,
    0xffffffff,
  );
  image.composite(propertyNameText, 65, 65);

  const authorText = Image.renderText(
    font,
    32,
    `created by ${authorName}`,
    0xffffffff,
  );
  image.composite(authorText, 65, 145);

  // const textLayout2 = new TextLayout({ maxWidth: 900, maxHeight: 160, wrapStyle: 'word' });
  const textLayout = {
    maxWidth: 900,
    maxHeight: 160,
    wrapStyle: "word",
    verticalAlign: "left",
    horizontalAlign: "top",
    wrapHardBreaks: true,
  };
  const descriptionText = Image.renderText(
    font,
    32,
    description,
    0xffffffff,
    textLayout,
  );
  image.composite(descriptionText, 65, 225);

  const karmaText = Image.renderText(font, 30, "karma", 0xffffffff);
  image.composite(karmaText, 65, 435);

  const karmaValueText = Image.renderText(boldFont, 50, `${karma}`, 0xffffffff);
  image.composite(karmaValueText, 65, 475);

  const marketText = Image.renderText(font, 30, "market", 0xffffffff);
  image.composite(marketText, 325, 435);

  const marketValueText = Image.renderText(
    boldFont,
    50,
    `${market}`,
    0xffffffff,
  );
  image.composite(marketValueText, 325, 475);

  const encoded = await image.encode(1);

  const headers = new Headers();
  headers.set("Content-Type", "image/png");

  req.respond({
    status: 200,
    headers,
    body: encoded,
  });
};

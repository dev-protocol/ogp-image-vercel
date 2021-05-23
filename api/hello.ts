import { ServerRequest } from "https://deno.land/std@0.97.0/http/server.ts";
import { Image } from "https://deno.land/x/imagescript@1.2.6/mod.ts";

const __filename = new URL(".", import.meta.url).pathname;
const RESOURCE_ROOT = `${__filename}`;

const DEVPROTOCOL_GRAPHQL_URL = "https://api.devprotocol.xyz/v1/graphql";
const DEVPROTOCOL_PROPERTY_URL = "https://api.devprotocol.xyz/v1/property";
const DEVPROTOCOL_FOR_APPS_URL = "https://dev-for-apps.azureedge.net";

const getPropertyInfo = async (propertyAddress: string) => {
  const body = `{
    "operationName": "getPropertyAuthentication",
    "variables": {
      "propertyAddress": "${propertyAddress}"
    },
    "query": "query getPropertyAuthentication($propertyAddress: String!) { property_authentication(where: {property: {_eq: $propertyAddress}}) {  authentication_id    market    metrics    property_meta { author      __typename    }    __typename  }}"
  }`;
  const res = await fetch(DEVPROTOCOL_GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body,
  }).then(res => res.json());
  const propertyName = res?.data.property_authentication[0].authentication_id;
  const authorAddress = res?.data.property_authentication[0].property_meta.author;
  return {
    propertyName,
    authorAddress,
  }
}

const getAuthorInfo = async (propertyAddress: string) => {
  const url = `${DEVPROTOCOL_PROPERTY_URL}/${propertyAddress}`;
  const res = await fetch(url).then(res => res.json());
  const name = res.name;
  const karma = res.author.karma;
  return {
    name,
    karma,
  }
}

const getPropertyDetail = async (propertyAddress: string) => {
  const url = `${DEVPROTOCOL_FOR_APPS_URL}/properties?address=${propertyAddress}`;
  const res = await fetch(url).then(res => res.json());
  const description = res[0].description
  return { description }
}

export default async (req: ServerRequest) => {
  const base = `${req.headers.get('x-forwarded-proto')}://${req.headers.get('x-forwarded-host')}`;
  const url = new URL(req.url, base);

  const propertyAddress = url.searchParams.get('address');
  if (!propertyAddress?.startsWith("0x") || !propertyAddress) {
    req.respond({
      status: 400,
    })
    return;
  }
  console.debug(req.url, url, propertyAddress);

  const binary = await Deno.readFile(`${RESOURCE_ROOT}/base.png`);
  const font = await Deno.readFile(`${RESOURCE_ROOT}/Roboto-Regular.ttf`);
  const boldFont = await Deno.readFile(`${RESOURCE_ROOT}/Roboto-Bold.ttf`);
  const image = await Image.decode(binary);

  // const { propertyName } = await getPropertyInfo(propertyAddress);
  // const { name: authorName, karma } = await getAuthorInfo(propertyAddress);
  const res = await Promise.all([
    getPropertyInfo(propertyAddress),
    getAuthorInfo(propertyAddress),
    getPropertyDetail(propertyAddress),
  ]);
  const propertyName = res[0].propertyName;
  const authorName = res[1].name;
  const karma = res[1].karma;
  const description = res[2].description;

  // render text
  const propertyNameText = Image.renderText(boldFont, 60, propertyName, 0xffffffff);
  image.composite(propertyNameText, 65, 65);
  const authorText = Image.renderText(font, 40, `Created by ${authorName}`, 0xffffffff);
  image.composite(authorText, 65, 145);
  const descriptionText = Image.renderText(font, 40, description, 0xffffffff);
  image.composite(descriptionText, 65, 245);
  const karmaText = Image.renderText(font, 40, "Karma", 0xffffffff);
  image.composite(karmaText, 65, 435);
  const karmaValueText = Image.renderText(boldFont, 50, `${karma}`, 0xffffffff);
  image.composite(karmaValueText, 65, 475);

  const encoded = await image.encode(1);

  const headers = new Headers();
  headers.set('Content-Type', 'image/png');

  req.respond({
    status: 200,
    headers,
    body: encoded,
  });
};

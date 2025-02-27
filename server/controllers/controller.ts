import { Request, Response } from 'express';
import fetchBadge from '../services/fetchBadges';
import iconDatabase from '../services/iconDatabase';

async function listIconsJSON(req: Request, res: Response): Promise<void> {
  res.status(200).json({
    icons: await iconDatabase.getIcons(),
  });
}

async function getBadge(req: Request, res: Response): Promise<void> {
  const slug = (req.query.logo || '') as string;
  // check if slug exists
  const item = slug ? await iconDatabase.checkSlugExists(slug) : null;
  // get badge for item
  const response = await fetchBadge.fetchBadgeFromRequest(req, item);
  // get content type
  const contentType = response.headers['content-type'] || 'image/svg+xml';
  // send response
  res.status(response.status).type(contentType).send(response.data);
}

async function postIcon(req: Request, res: Response): Promise<void> {
  const { slug, type, data }: { slug: string, type: string, data: string } = req.body;

  // Check for missing fields in the request
  if (!slug || !type || !data) {
    res.status(400).json({
      type: 'error',
      message: 'Bad request.',
      body: { slug, type, data },
    });
    return;
  }

  console.log(`Received icon for ${slug}`);

  // get the badge for item data
  const logoBadgeResponse = await fetchBadge.fetchBadgeFromRequest(req, { slug, type, data });
  // if the response is 414, the icon is too big
  if (logoBadgeResponse.status === 414) {
    res.status(logoBadgeResponse.status).json({
      type: 'error',
      message: 'The icon you uploaded is too big.',
      body: { slug, type, data },
    });
    return;
  }
  // check for other errors
  if (logoBadgeResponse.status >= 400) {
    res.status(logoBadgeResponse.status).json({
      type: 'error',
      message: `There was an error with your request. Status: ${logoBadgeResponse.status} - ${logoBadgeResponse.statusText}.`,
      body: { slug, type, data },
    });
    return;
  }

  // check for slug in the database
  const item = await iconDatabase.checkSlugExists(slug);

  // Get default badge with the logo set to the slug
  const defaultBadgeResponse = await fetchBadge.fetchDefaultBadge(slug);

  // Check if the slug is reserved
  // Slug is reserved if it is in the database or shields.io has an icon for it
  if (item !== null || defaultBadgeResponse.data.match(/<image[^>]*>/) !== null) {
    console.log('Slug is already in use');
    // slug already exists
    res.status(409).json({
      type: 'error',
      message: 'This slug is already in use.',
      body: { slug, type, data },
    });
    return;
  }

  // All checks passed, add the icon to the database
  console.log(`Creating new icon for ${slug}`);
  // create item
  const body = await iconDatabase.insertIcon(slug, type, data);
  // return success response
  res.status(200).json({
    type: 'success',
    message: 'Your icon has been added successfully.',
    body,
  });
}

const defaultExport = {
  listIconsJSON,
  getBadge,
  postIcon,
};

export default defaultExport;

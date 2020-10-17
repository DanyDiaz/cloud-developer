import { Router, Request, Response } from 'express';
import { FeedItem } from '../models/FeedItem';
import { requireAuth } from '../../users/routes/auth.router';
import * as AWS from '../../../../aws';

const router: Router = Router();

// Get all feed items
router.get('/', async (req: Request, res: Response) => {
    const items = await FeedItem.findAndCountAll({order: [['id', 'DESC']]});
    items.rows.map((item) => {
            if(item.url) {
                item.url = AWS.getGetSignedUrl(item.url);
            }
    });
    res.send(items);
});

//@TODO
//Add an endpoint to GET a specific resource by Primary Key
router.get('/:id', async (req: Request, res: Response) => {
    const id = req.params.id;
    const intId = parseInt(id)
    // check if id is present
    if (!id || isNaN(intId)) {
        return res.status(400).send({ message: 'id is missing or is not a number.' });
    }

    let item = await FeedItem.findByPk(intId);

    if(item === null) {
        return res.status(404).send({ message: `item not found for id: ${id}` });
    }
    else {
        if(item.url) {
            item.url = AWS.getGetSignedUrl(item.url);
        }
        return res.status(200).send(item);
    }
});

// update a specific resource
router.patch('/:id', 
    requireAuth, 
    async (req: Request, res: Response) => {
        //@TODO try it yourself
        const id = req.params.id;
        const caption = req.body.caption;
        const fileName = req.body.url;
        const intId = parseInt(id)
        // check id is present
        if (!id || isNaN(intId)) {
            return res.status(400).send({ message: 'id is missing or is not a number.' });
        }
        if (!caption && !fileName) {
            return res.status(400).send({ message: 'It was expected at least one property to update.' });
        }
        //first fetch the original item
        let item = await FeedItem.findByPk(intId);
        if(item === null) {
            return res.status(404).send({ message: `item not found for id: ${id}` });
        }
        else {
            interface myUrl {
                caption?: string,
                url?: string
            }

            let values: myUrl
            if (caption && caption !== '') {
                values.caption = caption;
            }
            if (fileName && fileName !== '') {
                values.url = fileName;
            }
            let [number, affectedItems] = await FeedItem.update(values, { where: { id: intId}, returning: true });
            affectedItems[0].url = AWS.getGetSignedUrl(affectedItems[0].url);
            return res.status(200).send(affectedItems[0]);
        }
});


// Get a signed url to put a new item in the bucket
router.get('/signed-url/:fileName', 
    requireAuth, 
    async (req: Request, res: Response) => {
    let { fileName } = req.params;
    const url = AWS.getPutSignedUrl(fileName);
    res.status(201).send({url: url});
});

// Post meta data and the filename after a file is uploaded 
// NOTE the file name is they key name in the s3 bucket.
// body : {caption: string, fileName: string};
router.post('/', 
    requireAuth, 
    async (req: Request, res: Response) => {
    const caption = req.body.caption;
    const fileName = req.body.url;

    // check Caption is valid
    if (!caption) {
        return res.status(400).send({ message: 'Caption is required or malformed' });
    }

    // check Filename is valid
    if (!fileName) {
        return res.status(400).send({ message: 'File url is required' });
    }

    const item = await new FeedItem({
            caption: caption,
            url: fileName
    });

    const saved_item = await item.save();

    saved_item.url = AWS.getGetSignedUrl(saved_item.url);
    res.status(201).send(saved_item);
});

export const FeedRouter: Router = router;
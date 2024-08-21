import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import createDebugMessages from 'debug';
import { convert } from 'html-to-text';
import axios from 'axios';
import md5 from 'md5';
import * as cheerio from 'cheerio'

import { BaseLoader } from '../interfaces/base-loader.js';
import { cleanString, truncateCenterString } from '../util/strings.js';

export class WebLoader extends BaseLoader<{ type: 'WebLoader' }> {
    private readonly debug = createDebugMessages('maap:loader:WebLoader');
    private readonly contentOrUrl: string;
    private readonly isUrl: boolean;

    constructor({ }: { url: string; chunkSize?: number; chunkOverlap?: number });
    constructor({ }: { content: string; chunkSize?: number; chunkOverlap?: number });
    constructor({
        content,
        url,
        chunkSize,
        chunkOverlap,
    }: {
        content?: string;
        url?: string;
        chunkSize?: number;
        chunkOverlap?: number;
    }) {
        super(`WebLoader_${md5(content ? `CONTENT_${content}` : `URL_${url}`)}`, chunkSize ?? 2000, chunkOverlap ?? 0);

        this.isUrl = content ? false : true;
        this.contentOrUrl = content ?? url;
    }

    override async *getUnfilteredChunks() {
        const chunker = new RecursiveCharacterTextSplitter({
            chunkSize: this.chunkSize,
            chunkOverlap: this.chunkOverlap,
        });

        try {
            let links = await getLinks(this.contentOrUrl)
            links = links.concat(this.contentOrUrl)
            console.log(links)

            const data = this.isUrl
                ? (await axios.get<string>(this.contentOrUrl, { responseType: 'document' })).data
                : this.contentOrUrl;

            const text = convert(data, {
                baseElements: {
                    selectors: [
                        'article#rsArticle'
                    ]
                },
                wordwrap: false,
                preserveNewlines: false,
            }).replace(/(?:https?|ftp):\/\/[\n\S]+/g, '');

            const tuncatedObjectString = this.isUrl ? undefined : truncateCenterString(this.contentOrUrl, 50);

            const chunks = await chunker.splitText(cleanString(text));
            for (const chunk of chunks) {
                yield {
                    pageContent: chunk,
                    metadata: {
                        type: <'WebLoader'>'WebLoader',
                        source: this.isUrl ? this.contentOrUrl : tuncatedObjectString,
                    },
                };
            }
        } catch (e) {
            this.debug('Could not parse input', this.contentOrUrl, e);
        }
    }
}
async function recursiveDownload
async function getLinks(url) {
    try {
        // Fetch the page content
        const response = await fetch(url);
        const html = await response.text();

        // Load the HTML into Cheerio
        const $ = cheerio.load(html);

        // Select all anchor tags from the page
        let links = [];
        $("#rsArticle").find("a").each((index, element) => {

            // Select all href attributes and replace new line characters
            const link = $(element).attr('href').replace(/(\r\n|\n|\r)/gm, "");
            if (link && link.trim() !== '') {
                if (link.includes("html"))
                    if (!links.includes("www")) {
                        links.push("www.unibas.ch" + link.trim());
                    } else {
                        links.push(link.trim());
                    }
            }
        });

        // Log the links

        // Return the links
        return links;
    } catch (err) {
        console.log('Failed to fetch page: ', err);
        return []; // Return an empty array in case of error
    }
}

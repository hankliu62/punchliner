import type { Joke, JokeResponse, JokeListResponse } from '@/types';

const MXNZP_APP_ID = process.env.MXNZP_APP_ID || '';
const MXNZP_APP_SECRET = process.env.MXNZP_APP_SECRET || '';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

export async function getRandomJokes(): Promise<Joke[]> {
  try {
    const response = await fetch(
      `https://www.mxnzp.com/api/jokes/list/random?app_id=${MXNZP_APP_ID}&app_secret=${MXNZP_APP_SECRET}`,
      { cache: 'no-store' }
    );

    const data: JokeResponse = await response.json();

    if (data.code === 1 && data.data) {
      return data.data.map((item) => ({
        id: generateId(),
        content: item.content,
        updateTime: item.updateTime,
      }));
    }

    return [];
  } catch (error) {
    console.error('Failed to fetch random jokes:', error);
    return [];
  }
}

export async function getJokesByPage(page: number = 1): Promise<JokeListResponse['data'] | null> {
  try {
    const response = await fetch(
      `https://www.mxnzp.com/api/jokes/list?page=${page}&app_id=${MXNZP_APP_ID}&app_secret=${MXNZP_APP_SECRET}`,
      { cache: 'no-store' }
    );

    const data: JokeListResponse = await response.json();

    if (data.code === 1 && data.data) {
      return {
        ...data.data,
        list: data.data.list.map((item) => ({
          id: generateId(),
          content: item.content,
          updateTime: item.updateTime,
        })),
      };
    }

    return null;
  } catch (error) {
    console.error('Failed to fetch jokes:', error);
    return null;
  }
}

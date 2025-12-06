import axios from 'axios';

export const streamToken = async (
  correlationId: string,
  token?: string
): Promise<void> => {
  const url = `${process.env.NODE_MANAGER_SERVER}/p2p-queue/${correlationId}`;

  try {
    await axios.post(
      url,
      { text: token ?? '__END__' },
      {
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (err) {
    console.error(`Cannot stream tokens. Error: ${err}`);
  }
};

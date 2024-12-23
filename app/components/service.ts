"use server";
const CLOUDFLARE_API_URL = "https://api.cloudflare.com/client/v4/accounts/114369a2af575013e09a86cf35e99477/images/v1"
const CLOUDFLARE_API_TOKEN = "p_sctF4Nt8j9Q359O0jtmh6XMd35fjpKhFyeBQu2"

async function uploadToCloudflare(fileData: File) {
  console.log('Uploading to Cloudflare');
  const formData = new FormData();
  formData.append("file", fileData);

  try {
    if (!CLOUDFLARE_API_URL) {
      throw new Error('CLOUD_FLARE_API_URL is not defined');
    }
    const response = await fetch(CLOUDFLARE_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to upload to Cloudflare:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
      });
      throw new Error(errorData.errors?.[0]?.message || 'Failed to upload to Cloudflare');
    }

    const data = await response.json();
    const imageUrl = data.result.variants[0];
    return imageUrl;
  } catch (err) {
    console.error('Error uploading to Cloudflare:', {
      message: (err as Error).message,
      stack: (err as Error).stack,
      name: (err as Error).name,
    });
    throw err;
  }
}

export { uploadToCloudflare };
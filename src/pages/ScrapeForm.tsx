import { useState, FormEvent, ChangeEvent } from 'react';
import './ScrapeForm.scss';
import { processHtmlContent } from '../utils/processHtmlContent';
import { text } from 'stream/consumers';

interface ScrapeFormProps {
  onScrapedContent: (content: string) => void;
}

export function ScrapeForm({ onScrapedContent }: ScrapeFormProps) {
  const [url, setUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleUrlChange = (event: ChangeEvent<HTMLInputElement>) => {
   
    setUrl(event.target.value);
  };

  // Add url protocol if doesnt include
  const checkUrl = (url: string): string => {
    console.log('se llamo check')
    const includesProtocol = url.includes('https://')
    if (!includesProtocol) {
      url = 'https://' + url;
    }
    return url
  }


  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    const finalUrl = checkUrl(url);
    setError(null);

    const scrapingAntApiKey = process.env.REACT_APP_SCRAPINGANT;
    // Usa endpoint con ScrapingAnt
    if (scrapingAntApiKey) {
      const apiEndpoint = `https://api.scrapingant.com/v2/general?url=${encodeURIComponent(
        finalUrl
      )}&x-api-key=${scrapingAntApiKey}&block_resource=stylesheet&block_resource=image&block_resource=font`;

      try {
        const response = await fetch(apiEndpoint);
        console.log(response)
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const htmlContent = await response.text();
        const textContent = processHtmlContent(htmlContent);
        console.log("html", textContent)
        onScrapedContent(textContent);
      } catch (error) {
        console.error('Error while calling ScrapingAnt:', error);
        setError('Ha ocurrido un error al intentar consultar el sitio web');
      } finally {
        setIsLoading(false);
      }
    }
    // Usa endpoint con n8n
    else {
      const n8nScrapingWorkflow = process.env.REACT_APP_N8N_SCRAPING_WORKFLOW;
      const workflowKey = process.env.REACT_APP_N8N_HEADERS_AUTH;
      if (!n8nScrapingWorkflow) {
        setError('Ha ocurrido un error... intentelo nuevamente');
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`${n8nScrapingWorkflow}?url=${finalUrl}`, {
          headers: {
            'Authorization': workflowKey || ''
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const textContent = await response.text();
        onScrapedContent(textContent);
      } catch (error) {
        console.error('Error while calling n8nScrapingWorkflow:', error);
        setError('Ha ocurrido un error al intentar consultar el sitio web');
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Asegúrate de que el return está dentro de la función ScrapeForm
  return (
    <div className="form-container">
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={url}
          onChange={handleUrlChange}
          placeholder="Ingresa una URL"
          required
          className="url-input"
        />
        <button type="submit" disabled={isLoading} className="submit-button">
          {isLoading ? <div className="spinner"></div> : '>'}
        </button>
      </form>

      {error && <p className="error-message">{error}</p>}

    </div>
  );
}

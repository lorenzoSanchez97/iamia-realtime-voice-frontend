const LOCAL_RELAY_SERVER_URL: string =
  process.env.REACT_APP_LOCAL_RELAY_SERVER_URL || '';

import { useEffect, useRef, useCallback, useState } from 'react';

import { RealtimeClient } from '@openai/realtime-api-beta';
import { ItemType } from '@openai/realtime-api-beta/dist/lib/client.js';
import { WavRecorder, WavStreamPlayer } from '../lib/wavtools/index.js';
import { WavRenderer } from '../utils/wav_renderer';

import { X, Edit, Zap } from 'react-feather';
import { Button } from '../components/button/Button';

import './VoiceChat.scss';

type Props = {
  scrapedContent: string;
};

export const VoiceChat: React.FC<Props> = ({ scrapedContent }) => {
  const apiKey = LOCAL_RELAY_SERVER_URL
    ? ''
    : localStorage.getItem('tmp::voice_api_key') ||
    prompt('OpenAI API Key') ||
    '';
  if (apiKey !== '') {
    localStorage.setItem('tmp::voice_api_key', apiKey);
  }

  const instructions = `SYSTEM SETTINGS:
------
INSTRUCCIONES:
-Recibirás datos de un sitio web sobre una compañía: INFORMACIÓN DE LA EMPRESA.
-Eres un agente de ventas que trabaja para IAMIA, una agencia que ofrece soluciones de automatización personalizadas para empresas que necesitan implementar sistemas avanzados de IA.
-Comienza la conversación haciendo un elogio sobre la INFORMACIÓN DE LA EMPRESA, destacando el rubro al que se dedica. Además, menciona algo positivo sobre su sitio web basado en la INFORMACIÓN DE LA EMPRESA.
-Luego, continúa la conversación ofreciendo los servicios de IAMIA que mejor se adapten a las caracterisitcas o necesidades de la empresa, explicando cómo pueden beneficiarla.
-Puedes hacer preguntas al usuario.

------
SERVICIOS QUE OFRECE IAMIA:
-Diseño y despliegue de ecosistemas de IA: Implementamos ecosistemas con SmithOS y Relevance AI para automatizar tareas complejas sin intervención manual.

-Relevance AI: Proporciona procesamiento de datos, interacciones con prospectos y modelos de IA personalizados.

-SmithOS: Crea agentes de IA para manejar interacciones, citas y calificación de prospectos en varios canales.

-Escalabilidad: Los ecosistemas de IA son escalables, adaptándose al crecimiento sin ajustes manuales.

-Gestión de prospectos con IA: Capturamos y calificamos prospectos de múltiples canales (sitios web, WhatsApp, redes sociales), activando seguimientos y citas automáticas.

-Flota de agentes de IA: Incluye agentes para calificar prospectos, programar citas, realizar seguimientos automáticos y gestionar facturación.

-Bots de WhatsApp y voz: Bots multilingües interactúan con clientes para calificar prospectos, programar citas y confirmar llamadas, sin intervención humana.

-Automatización de procesos robóticos (RPA): Automatizamos tareas administrativas como facturación y seguimiento de pedidos, liberando tiempo para tareas de mayor valor.

-Paneles personalizables: Usamos Make.com y Bubble para crear paneles que permiten a las empresas controlar flujos de trabajo automáticos y monitorear el rendimiento.

-Integración completa de IA: Los ecosistemas de IAMIA se integran con SmithOS y Relevance AI para automatizar la gestión de prospectos, citas y retención de clientes.

-Agentes de IA para prospectos: Incluyen agentes de calificación, seguimiento y referidos, optimizando el ciclo de vida del cliente.

-Agentes de citas: Los bots de voz y WhatsApp programan y gestionan citas automáticamente, reduciendo errores manuales.

-Retención y facturación: Agentes de IA automatizan la retención de clientes y el proceso de facturación.

-Comunicación multicanal: Los agentes gestionan comunicaciones por email, SMS, WhatsApp y voz, personalizando interacciones para aumentar conversiones.

-IA conversacional: Relevance AI facilita interacciones más naturales y humanas, generando confianza en clientes B2B y B2C.

-Autoaprendizaje de IA: Los agentes aprenden de cada interacción, mejorando sus respuestas sin reprogramación.

-Proyectos destacados: En una clínica dental, implementamos captura de prospectos, IA para citas y facturación, y un panel de control personalizado para todo el proceso.

-Capacidades de entrega: Los ecosistemas de IAMIA automatizan desde la captación de prospectos hasta la facturación, ofreciendo escalabilidad y personalización.

-Automatización multilingüe: Creamos bots multilingües para atender mercados locales e internacionales.

-Integración de extremo a extremo: Ofrecemos una solución integral que cubre todo el proceso, asegurando que las empresas se enfoquen en lo esencial sin gestionar un CRM.


------
PERSONALIDAD:
- Amigable y profesional
- Conocedor de los servicios de IAMIA
- Tu respuesta debe ser concisa y directa, mantenla breve, con un máximo de 200 caracteres.
- Capaz de manejar consultas B2B y B2C
- Responder en español y con acento Mexicano.

------
*INFORMACIÓN DE LA EMPRESA* A LA QUE DEBES OFRECERLE LOS SERVICIOS DE IAMIA:
${scrapedContent}
`;

  /**
   * Instantiate:
   * - WavRecorder (speech input)
   * - WavStreamPlayer (speech output)
   * - RealtimeClient (API client)
   */
  const wavRecorderRef = useRef<WavRecorder>(
    new WavRecorder({ sampleRate: 24000 })
  );
  const wavStreamPlayerRef = useRef<WavStreamPlayer>(
    new WavStreamPlayer({ sampleRate: 24000 })
  );
  const clientRef = useRef<RealtimeClient>(
    new RealtimeClient(
      LOCAL_RELAY_SERVER_URL
        ? { url: LOCAL_RELAY_SERVER_URL }
        : {
          apiKey: apiKey,
          dangerouslyAllowAPIKeyInBrowser: true,
        }
    )
  );

  /**
   * References for
   * - Rendering audio visualization (canvas)
   * - Autoscrolling event logs
   * - Timing delta for event log displays
   */
  const clientCanvasRef = useRef<HTMLCanvasElement>(null);
  const serverCanvasRef = useRef<HTMLCanvasElement>(null);
  const startTimeRef = useRef<string>(new Date().toISOString());

  const [items, setItems] = useState<ItemType[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const resetAPIKey = useCallback(() => {
    const apiKey = prompt('OpenAI API Key');
    if (apiKey !== null) {
      localStorage.clear();
      localStorage.setItem('tmp::voice_api_key', apiKey);
      window.location.reload();
    }
  }, []);

  /**
   * Connect to conversation:
   * WavRecorder takes speech input, WavStreamPlayer output, client is API client
   */
  const connectConversation = useCallback(async () => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;

    startTimeRef.current = new Date().toISOString();
    setIsConnected(true);
    setItems(client.conversation.getItems());

    // Connect to microphone
    await wavRecorder.begin();

    // Connect to audio output
    await wavStreamPlayer.connect();

    // Connect to realtime API
    await client.connect();
    client.sendUserMessageContent([
      {
        type: `input_text`,
        text: `Hello!`, // Can change this initial text
      },
    ]);

    if (client.getTurnDetectionType() === 'server_vad') {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    }
  }, []);

  /**
   * Disconnect and reset conversation state
   */
  const disconnectConversation = useCallback(async () => {
    setIsConnected(false);
    setItems([]);

    const client = clientRef.current;
    client.disconnect();

    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.end();

    const wavStreamPlayer = wavStreamPlayerRef.current;
    await wavStreamPlayer.interrupt();
  }, []);

  const deleteConversationItem = useCallback(async (id: string) => {
    const client = clientRef.current;
    client.deleteItem(id);
  }, []);

  /**
   * Switch between Manual <> VAD mode for communication
   */
  const changeTurnEndType = async (value: string) => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    if (value === 'none' && wavRecorder.getStatus() === 'recording') {
      await wavRecorder.pause();
    }
    client.updateSession({
      turn_detection: value === 'none' ? null : { type: 'server_vad' },
    });
    if (value === 'server_vad' && client.isConnected()) {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    }
  };

  /**
   * Auto-scroll the conversation logs
   */
  useEffect(() => {
    const conversationEls = [].slice.call(
      document.body.querySelectorAll('[data-conversation-content]')
    );
    for (const el of conversationEls) {
      const conversationEl = el as HTMLDivElement;
      conversationEl.scrollTop = conversationEl.scrollHeight;
    }
  }, [items]);

  /**
   * Set up render loops for the visualization canvas
   */
  useEffect(() => {
    let isLoaded = true;

    changeTurnEndType('server_vad');

    const wavRecorder = wavRecorderRef.current;
    const clientCanvas = clientCanvasRef.current;
    let clientCtx: CanvasRenderingContext2D | null = null;

    const wavStreamPlayer = wavStreamPlayerRef.current;
    const serverCanvas = serverCanvasRef.current;
    let serverCtx: CanvasRenderingContext2D | null = null;

    const render = () => {
      if (isLoaded) {
        if (clientCanvas) {
          if (!clientCanvas.width || !clientCanvas.height) {
            clientCanvas.width = clientCanvas.offsetWidth;
            clientCanvas.height = clientCanvas.offsetHeight;
          }
          clientCtx = clientCtx || clientCanvas.getContext('2d');
          if (clientCtx) {
            clientCtx.clearRect(0, 0, clientCanvas.width, clientCanvas.height);
            const result = wavRecorder.recording
              ? wavRecorder.getFrequencies('voice')
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              clientCanvas,
              clientCtx,
              result.values,
              '#70BEFA',
              10,
              0,
              8
            );
          }
        }
        if (serverCanvas) {
          if (!serverCanvas.width || !serverCanvas.height) {
            serverCanvas.width = serverCanvas.offsetWidth;
            serverCanvas.height = serverCanvas.offsetHeight;
          }
          serverCtx = serverCtx || serverCanvas.getContext('2d');
          if (serverCtx) {
            serverCtx.clearRect(0, 0, serverCanvas.width, serverCanvas.height);
            const result = wavStreamPlayer.analyser
              ? wavStreamPlayer.getFrequencies('voice')
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              serverCanvas,
              serverCtx,
              result.values,
              '#d8719a',
              10,
              0,
              8
            );
          }
        }
        window.requestAnimationFrame(render);
      }
    };
    render();

    return () => {
      isLoaded = false;
    };
  }, []);

  /**
   * Core RealtimeClient and audio capture setup
   * Set all of our instructions, tools, events and more
   */
  useEffect(() => {
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const client = clientRef.current;

    client.updateSession({ instructions: instructions });
    client.updateSession({ input_audio_transcription: { model: 'whisper-1' } });
    client.updateSession({ voice: 'alloy' });

    client.on('error', (event: any) => console.error(event));
    client.on('conversation.interrupted', async () => {
      const trackSampleOffset = await wavStreamPlayer.interrupt();
      if (trackSampleOffset?.trackId) {
        const { trackId, offset } = trackSampleOffset;
        await client.cancelResponse(trackId, offset);
      }
    });
    client.on('conversation.updated', async ({ item, delta }: any) => {
      const items = client.conversation.getItems();
      if (delta?.audio) {
        wavStreamPlayer.add16BitPCM(delta.audio, item.id);
      }
      if (item.status === 'completed' && item.formatted.audio?.length) {
        const wavFile = await WavRecorder.decode(
          item.formatted.audio,
          24000,
          24000
        );
        item.formatted.file = wavFile;
      }
      setItems(items);
    });

    setItems(client.conversation.getItems());

    return () => {
      // cleanup; resets to defaults
      client.reset();
    };
  }, []);

  /**
   * Render the application
   */
  return (
    <div data-component="VoiceChat">
      <div className="content-main">
        <div className="content-logs">
          <div className="content-block events">
            <div className="visualization">
              <div className="visualization-entry client">
                <canvas ref={clientCanvasRef} />
              </div>
              <div className="visualization-entry server">
                <canvas ref={serverCanvasRef} />
              </div>
            </div>
          </div>

          {/* Transcripción de mensajes */}

          {/* {items.length > 0 && (
            <div className="content-block conversation">
              <div className="content-block-body" data-conversation-content>
                {items.map((conversationItem, i) => {
                  return (
                    <div
                      className="conversation-item"
                      key={conversationItem.id}
                    >
                      <div className={`speaker ${conversationItem.role || ''}`}>
                        <div>
                          {(
                            conversationItem.role || conversationItem.type
                          ).replaceAll('_', ' ')}
                        </div>
                        <div
                          className="close"
                          onClick={() =>
                            deleteConversationItem(conversationItem.id)
                          }
                        >
                          <X />
                        </div>
                      </div>
                      <div className={`speaker-content`}>
                        {!conversationItem.formatted.tool &&
                          conversationItem.role === 'user' && (
                            <div>
                              {conversationItem.formatted.transcript ||
                                (conversationItem.formatted.audio?.length
                                  ? '(awaiting transcript)'
                                  : conversationItem.formatted.text ||
                                  '(item sent)')}
                            </div>
                          )}
                        {!conversationItem.formatted.tool &&
                          conversationItem.role === 'assistant' && (
                            <div>
                              {conversationItem.formatted.transcript ||
                                conversationItem.formatted.text ||
                                '(truncated)'}
                            </div>
                          )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )} */}

          <div className="content-actions">
            <Button
              label={isConnected ? 'Desconectar' : 'Conectar'}
              iconPosition={isConnected ? 'end' : 'start'}
              icon={isConnected ? X : Zap}
              buttonStyle={isConnected ? 'regular' : 'action'}
              onClick={
                isConnected ? disconnectConversation : connectConversation
              }
            />
          </div>
          <div className="content-title">
            <span>Habla con IAMIA</span>
          </div>
        </div>
      </div>
    </div>
  );
};

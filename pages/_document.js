import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta charSet="utf-8" />
        <link rel="shortcut icon" href="#" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:site" content="@mayfer" />
        <meta name="twitter:title" content="Pluck" />
        <meta name="twitter:description"
          content="This is an interactive string simulator that uses basic Fourier math to generate audio & visuals according to where on the string you pluck from. The audio math is done on the GPU in WebGL" />
        <meta name="twitter:image" content="https://i.imgur.com/DvnQIif.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}


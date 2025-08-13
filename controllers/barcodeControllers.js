const bwipjs = require('bwip-js');

exports.generateBarcode = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Texto requerido' });
    }

    const paddedText = String(text).padStart(10, '0');

    bwipjs.toBuffer({
      bcid: 'code128',
      text: paddedText,
      scale: 2,
      height: 25,
      includetext: true,
      textxalign: 'center',
      textsize: 9,
      backgroundcolor: 'FFFFFF'
    }, (err, png) => {
      if (err) {
        console.error('Error generando código:', err);
        return res.status(500).json({ error: 'Error generando código' });
      }

      res.set({
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store'
      });

      res.send(png);
    });

  } catch (error) {
    console.error('Error en controller:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

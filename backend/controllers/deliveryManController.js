const db = require('../database');

exports.main = (req, res) => {
  res.send('Information: Delivery man main page');
};

exports.deliveryManInfoRequest = (req, res) => {
  const { correo } = req.params;

  const query = `
    SELECT sr.solicitud_repartidor_id as id,
      nombres,
      apellidos,
      u.correo,
      no_celular,
      d.descripcion as 'departamento',
      m.descripcion as 'municipio',
      case when tiene_vehiculo=1 then 'si' else 'no' end as 'tiene_vehiculo',
      lc.descripcion as 'tipo_licencia',
      documento_url
    FROM tbl_solicitud_repartidor sr
    INNER JOIN tbl_usuario u ON sr.usuario_id = u.usuario_id
    INNER JOIN tbl_cat_municipio m ON sr.municipio_id = m.municipio_id
    INNER JOIN tbl_cat_departamento d ON m.departamento_id = d.departamento_id
    INNER JOIN tbl_cat_tipo_licencia_conducir lc ON sr.tipo_licencia_id = lc.tipo_licencia_conducir_id
    WHERE u.rol_usuario_id = 3 AND u.habilitado = 1 AND u.correo = ?;
  `;

  const values = [correo];
  db.query(query, values, (error, results) => {
    if (error) {
      res.status(500).json({ error: 'Error with delivery man request' });
    } else {
      const deliveryManInfo = {
        id: results[0].id,
        nombres: results[0].nombres,
        apellidos: results[0].apellidos,
        correo: results[0].correo,
        no_celular: results[0].no_celular,
        departamento: results[0].departamento,
        municipio: results[0].municipio,
        tiene_vehiculo: results[0].tiene_vehiculo,
        tipo_licencia: results[0].tipo_licencia,
        documento_url: results[0].documento_url
      };

      res.json(deliveryManInfo);
    }
  });
};

exports.changeLocation = (req, res) => {
  const { id, description, department, municipality } = req.body;

  const selectQuery = 'SELECT municipio_id FROM tbl_solicitud_repartidor WHERE solicitud_repartidor_id = ?';
  const selectValues = [id];
  db.query(selectQuery, selectValues, (selectError, selectResults) => {
    if (selectError) {
      console.error(selectError);
      res.status(500).json({ error: 'Error retrieving origin municipality' });
      return;
    }

    if (selectResults.length === 0) {
      res.status(404).json({ error: 'Solicitud repartidor not found' });
      return;
    }

    const origen_municipio_id = selectResults[0].municipio_id;
    const insertQuery = `
      INSERT INTO tbl_cambio_ubicacion_repartidor (origen_municipio_id, destino_municipio_id, motivo_solicitud, fecha_solicitud, estado_solicitud_id, repartidor_id)
      VALUES (?, ?, ?, NOW(), 0, ?)
    `;

    const insertValues = [origen_municipio_id, municipality, description, id];
    db.query(insertQuery, insertValues, (insertError, insertResults) => {
      if (insertError) {
        console.error(insertError);
        res.status(500).json({ error: 'Error adding location change' });
      } else {
        res.status(200).json({ message: 'Location change added successfully' });
      }
    });
  });
};

exports.orders = (req, res) => {
  const deliveryId = req.params.id;

  const getOrderQuery = `
    SELECT 
      p.pedido_id AS order_id,
      i.nombres AS client_names,
      i.apellidos AS last_names,
      i.no_celular AS phone,
      dm.descripcion AS department,
      cm.descripcion AS municipality,
      se.nombre AS company_name,
      p.descripcion AS description,
      CASE
        WHEN c.pedido_id IS NOT NULL THEN p.total_pedido - (p.total_pedido * 0.15)
        ELSE p.total_pedido
      END AS total,
      CASE
        WHEN c.pedido_id IS NOT NULL THEN 'Si'
        ELSE 'No'
      END AS coupon_applied
    FROM
      tbl_pedido AS p
      INNER JOIN tbl_informacion_usuario AS i ON p.usuario_id = i.usuario_id
      INNER JOIN tbl_cat_municipio AS cm ON i.municipio = cm.municipio_id
      INNER JOIN tbl_solicitud_empresa AS se ON p.empresa_id = se.solicitud_empresa_id
      INNER JOIN tbl_cat_departamento AS dm ON cm.departamento_id = dm.departamento_id
      LEFT JOIN tbl_cupones AS c ON p.pedido_id = c.pedido_id
    WHERE
      p.estado_id = 3 AND
      p.usuario_id = i.usuario_id AND
      i.municipio = (SELECT municipio_id FROM tbl_solicitud_repartidor WHERE usuario_id = ?);
  `;

  db.query(getOrderQuery, [deliveryId], (error, results) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'Error retrieving orders' });
    }
    const modifiedResults = results.map((result) => {
      return {
        order_id: result.order_id,
        client_names: result.client_names,
        last_names: result.last_names,
        phone: result.phone,
        department: result.department,
        municipality: result.municipality,
        company_name: result.company_name,
        description: result.description,
        total: result.total,
        coupon_applied: result.coupon_applied,
      };
    });
    return res.status(200).json(modifiedResults);
  });
};

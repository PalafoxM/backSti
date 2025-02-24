const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const mysql = require('mysql');

const {token_sti, usuario, password, database, host } = require('./config');
const { createCategory, 
        createCourse,
        updateCourse,
        getCategories,
        getCoursesByCategoryId,
        getCourseContents,
        updateAssignmentDates,
        crearCursosDesdeCSV,
        getCourseDetailsById,
        matricularEnMoodle,
        deleteUserid,
        enviarCorreo,
        createSubcategory } = require('./services/moodleService');


app.use(bodyParser.json());



 const staticToken = token_sti; 

//const HOSTNAME   = '172.31.113.61';
//const USUARIO    = 'root';
//const PASSWORD   = 'Gnosis01';
//const DATABASE   = 'moodle_prod'; 

const HOSTNAME   = 'localhost';
const USUARIO    = 'root';
const PASSWORD   = '';
const DATABASE   = 'ssp';

 const connection = mysql.createConnection({
    host: host,
    user: usuario,
    password: password,
    database: database
});
 const connectionMoodle = mysql.createConnection({
    host: HOSTNAME,
    user: USUARIO,
    password: PASSWORD,
    database: DATABASE
});

// Conectar a la base de datos
(async () => {
    try {
        await connection.connect();
        console.log('Conexión a la base de datos MariaDB establecida.');
    } catch (err) {
        console.error('Error al conectar a la base de datos:', err);
        process.exit(1); // Salir con código de error
    }
})();

(async () => {
    try {
        await connectionMoodle.connect();
        console.log('Conexión a la base de datos MOODLE establecida.');
    } catch (err) {
        console.error('Error al conectar a la base de datos:', err);
        process.exit(1); // Salir con código de error
    }
})();



// Middleware para verificar el token JWT
function verifyStaticToken(req, res, next) {
    const bearerHeader = req.headers['authorization'];

    if (typeof bearerHeader !== 'undefined') {
        const token = bearerHeader.split(' ')[1]; // Extraer el token
        jwt.verify(token, staticToken, (err, decoded) => {
            if (err) {
                return res.status(403).json({ error: true, respuesta: 'Token inválido o expirado' });
            } else {
                req.userData = decoded.data; // Datos decodificados del JWT
                next(); // Continuar si el token es válido
            }
        });
    } else {
        res.status(403).json({ error: true, respuesta: 'Token no proporcionado' });
    }
}

// Función para ejecutar consultas SQL (Promesa)
function query(sql, params) {
    console.log(sql, params);
    return new Promise((resolve, reject) => {
        connection.query(sql, params, (err, result) => {
            if (err) {
                return reject(err);
            }
            resolve(result);
        });
    });
}

// Función para iniciar la transacción
function beginTransaction() {
    return new Promise((resolve, reject) => {
        connection.beginTransaction(err => {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    });
}

// Función para hacer commit de la transacción
function commitTransaction() {
    return new Promise((resolve, reject) => {
        connection.commit(err => {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    });
}

// Función para hacer rollback de la transacción
function rollbackTransaction() {

    return new Promise((resolve, reject) => {
        connection.rollback(() => {
            resolve();
        });
    });
}
app.post('/getTabla', verifyStaticToken, async (req, res) => {
    const { data } = req.body;
    const response = {
        error: true,
        respuesta: 'Error|Parámetros de entrada',
        query: null,
        data: []
    };

    try {
        // Si se proporciona una query directa
        if (data.query) {
            try {
                const result = await query(data.query);
                response.query = data.query;
                response.data = result;
                response.error = false;
                response.respuesta = result.length === 0 ? 'No se encontraron resultados que coincidan con la búsqueda' : 'Consulta exitosa';
                return response;
            } catch (err) {
                response.respuesta = 'Fallo en la consulta a la base de datos';
                response.errorDB = err.message;
                return response;
            }
        }

        // Verificar que la tabla esté definida
        if (!data.tabla) return response;

        // Construir la query SQL dinámicamente
        let sql = `SELECT `;
        sql += data.select ? data.select.join(', ') : '*';
        sql += ` FROM ${data.tabla}`;

        // Manejo de JOINs
        if (data.join) {
            data.join.forEach(join => {
                const joinType = join[2] || 'RIGHT';
                sql += ` ${joinType} JOIN ${join[0]} ON ${join[1]}`;
            });
        }

        // Condiciones WHERE
        if (data.where) {
            const whereConditions = Object.keys(data.where)
                .map(key => `${key} = ?`)
                .join(' AND ');
            sql += ` WHERE ${whereConditions}`;
        }

        // Manejo de WHERE IN
        if (data.whereIn) {
            data.whereIn.forEach(whereIn => {
                const values = whereIn[1].map(() => '?').join(', ');
                sql += ` AND ${whereIn[0]} IN (${values})`;
            });
        }

        // Manejo de WHERE NOT IN
        if (data.whereNotIn) {
            data.whereNotIn.forEach(whereNotIn => {
                const values = whereNotIn[1].map(() => '?').join(', ');
                sql += ` AND ${whereNotIn[0]} NOT IN (${values})`;
            });
        }

        // LIKE
        if (data.like) {
            const likeConditions = Object.keys(data.like)
                .map(key => `${key} LIKE ?`)
                .join(' AND ');
            sql += ` AND ${likeConditions}`;
        }

        // OR LIKE
        if (data.orlike) {
            const orLikeConditions = Object.keys(data.orlike)
                .map(key => `${key} LIKE ?`)
                .join(' OR ');
            sql += ` AND (${orLikeConditions})`;
        }

        // GROUP BY
        if (data.groupBy) {
            sql += ` GROUP BY ${data.groupBy.join(', ')}`;
        }

        // ORDER BY
        if (data.orderBy) {
            sql += ` ORDER BY ${data.orderBy}`
        }

        // LIMIT
        if (data.limit) {
            if (data.limit.length && data.limit.start !== undefined) {
                sql += ` LIMIT ${data.limit.start}, ${data.limit.length}`;
            } else {
                sql += ` LIMIT ${data.limit}`;
            }
        }

        // Ejecutar la consulta construida
        const params = [
            ...(data.where ? Object.values(data.where) : []),
            ...(data.whereIn ? data.whereIn.flatMap(wi => wi[1]) : []),
            ...(data.whereNotIn ? data.whereNotIn.flatMap(wni => wni[1]) : []),
            ...(data.like ? Object.values(data.like).map(val => `%${val}%`) : []),
            ...(data.orlike ? Object.values(data.orlike).map(val => `%${val}%`) : [])
        ];

        const result = await query(sql, params);
        response.query = sql;
        response.data = result;
        response.error = false;
        response.respuesta = result.length === 0 ? 'No se encontraron resultados que coincidan con la búsqueda' : 'Consulta exitosa';
        return res.json(response);
    } catch (err) {
        response.respuesta = `Error|${err.message}`;
        return res.json(response);
    }
});

app.post('/matricularEnMoodle', async (req, res) => {
    const { usuarios, courseId } = req.body.data; // Asegúrate de enviar `usuarios` y `courseId` en el request
    console.log('Iniciando proceso de matriculación para el curso:', courseId);

    try {
        const matriculacionResultado = await matricularEnMoodle(usuarios, courseId);

        // Responde al front-end con los detalles del resultado de la matrícula
        res.json(matriculacionResultado);
    } catch (error) {
        console.error("Error en la API de Node.js:", error);
        res.status(500).json({
            error: true,
            respuesta: 'Error en la API de Node.js: ' + error.message
        });
    }
});

app.post('/crearCursosDesdeCSV', async (req, res) => {
    const {fullname, categoryid,startdate, enddate, idnumber } = req.body.data;
    console.log(fullname, categoryid, startdate, enddate, idnumber);
    console.log('crearCursosDesdeCSV');
    try {

            console.log("Creando curso con datos:");

            const result = await crearCursosDesdeCSV(fullname, categoryid, startdate, enddate, idnumber); // Función que crea el curso en Moodle
            if (!result) {
                return res.json({
                    error: true,
                    respuesta: 'Inconsistencia en el archivo, verificar ID moodle'
                });
            }
        res.json({
            error: false,
            respuesta: 'Cursos creados exitosamente'
        });
    } catch (error) {
        console.error("Error en la API de Node.js:", error);
        res.status(500).json({
            error: true,
            respuesta: 'Error en la API de Node.js: ' + error.message
        });
    }
});

app.post('/saveTabla', verifyStaticToken, async (req, res) => {
    const { data, config, bitacora } = req.body;
    let response = {
        error: true,
        respuesta: 'Error en la operación',
    };
    let idRegistro = 0;
    
    try {
        // Iniciar la transacción
        await beginTransaction();

        if (config.editar) {
            // Consulta para verificar si el registro existe
            const selectSQL = `SELECT * FROM ${config.tabla} WHERE ${Object.keys(config.idEditar).map(key => `${key} = ?`).join(' AND ')}`;
            const existingRecord = await query(selectSQL, Object.values(config.idEditar));
            
            if (!existingRecord || existingRecord.length === 0) {
                response.respuesta = 'Error|No se encontró el registro para editar';
                await rollbackTransaction();
                console.log(existingRecord);
                return res.json(response);
            }

            // Actualizar el registro existente
            const updateSQL = `UPDATE ${config.tabla} SET ? WHERE ${Object.keys(config.idEditar).map(key => `${key} = ?`).join(' AND ')}`;
            console.log([data, ...Object.values(config.idEditar)]);
   
            const updateResult = await query(updateSQL, [data, ...Object.values(config.idEditar)]);
           
            if (updateResult.affectedRows === 0) {
                response.respuesta = 'Error|No se pudo actualizar el registro';
                await rollbackTransaction();
                return res.json(response);
            }

            idRegistro = Object.values(config.idEditar)[0]; // Suponiendo que solo haya una clave en idEditar
        } else {
            // Insertar un nuevo registro
            console.log('entro al insert');
            const insertSQL = `INSERT INTO ${config.tabla} SET ?`;
            const insertResult = await query(insertSQL, data);
            console.log(insertResult);
            if (insertResult.affectedRows === 0) {
                response.respuesta = 'Error|No se pudo insertar el registro';
                await rollbackTransaction();
                return res.json(response);
            }
            idRegistro = insertResult.insertId;
        }

        // Insertar en la bitácora
        const bitacoraSQL = `INSERT INTO bitacora SET ?`;
        const bitacoraData = {
            script: bitacora.script,
            user: bitacora.id_user,  // ID del usuario extraído del token
            table: config.tabla,
            keyvalue: idRegistro
        };
        await query(bitacoraSQL, bitacoraData);

        // Commit de la transacción
        await commitTransaction();

        // Respuesta exitosa
        response.error = false;
        response.respuesta = 'Operación realizada correctamente';
        response.idRegistro = idRegistro;
    } catch (err) {
        // Rollback en caso de error
        await rollbackTransaction();
        response.respuesta = `Error|${err.message}`;
    }

    return res.json(response);
});
app.post('/enviarCorreo', verifyStaticToken, async (req, res) => {
    const { to, mensaje } = req.body.data;
    try {
        const response = await enviarCorreo(to, mensaje);
        if (response.error) {
            return res.json({
                error: true,
                respuesta: 'Error al enviar el correo',
                detalles: response.data
            });
        } else {
            return res.json({
                error: false,
                respuesta: 'Correo enviado exitosamente',
                data: response.data
            });
        }
    } catch (error) {
        console.error("Error en la API de Node.js:", error);
        res.json({
            error: true,
            respuesta: 'Error en la API de Node.js: ' + error.message
        });
    }
});
// Endpoint para crear la categoría en Node.js
app.post('/traerQuiz',verifyStaticToken , async (req, res) => {
    const { courseId } = req.body.data;
    console.log(courseId);
    try {
        const response = await traerQuiz(courseId);

        if (response.error) {
            return res.json({
                error: true,
                respuesta: 'Error getCourseContents',
                detalles: response.data
            });
        } else {
            return res.json({
                error: false,
                respuesta: 'getCourseContents exitosa',
                data: response.data
            });
        }
    } catch (error) {
        console.error("Error en la API de Node.js:", error);
        res.json({
            error: true,
            respuesta: 'Error en la API de Node.js: ' + error.message
        });
    }
});
app.post('/updateQuiz',verifyStaticToken , async (req, res) => {
    const { id_curso,timeopen, timeclose  } = req.body.data;
    console.log(id_curso,timeopen, timeclose);
    try {
        const response = await updateQuiz(id_curso, timeopen, timeclose);

        if (response.error) {
            return res.json({
                error: true,
                respuesta: 'Error getCourseContents',
                detalles: response.data
            });
        } else {
            return res.json({
                error: false,
                respuesta: 'getCourseContents exitosa',
                data: response.data
            });
        }
    } catch (error) {
        console.error("Error en la API de Node.js:", error);
        res.json({
            error: true,
            respuesta: 'Error en la API de Node.js: ' + error.message
        });
    }
});

// Función para obtener quizzes de un curso en la base de datos de Moodle
function updateQuiz(courseId, timeopen, timeclose) {
    console.log( courseId, timeopen, timeclose);
    return new Promise((resolve, reject) => {
        // Actualización de `timeopen` y `timeclose` para el quiz en el curso especificado
        connectionMoodle.query(
            'UPDATE mdl_quiz SET timeopen = ?, timeclose = ? WHERE id = ?',
            [timeopen, timeclose, courseId],
            (error, results) => {
                if (error) {
                    console.error('Error en updateQuiz:', error);
                    return reject({
                        error: true,
                        message: error.message
                    });
                }
                
                // Comprobar si la actualización afectó alguna fila
                if (results.affectedRows > 0) {
                    console.log('Quiz actualizado exitosamente.');
                    resolve({
                        error: false,
                        message: 'Quiz actualizado exitosamente.'
                    });
                } else {
                    console.log('No se encontró ningún quiz para actualizar.');
                    resolve({
                        error: true,
                        message: 'No se encontró ningún quiz para actualizar o los valores ya eran los mismos.'
                    });
                }
            }
        );
    });
}

function traerQuiz(courseId) {
    return new Promise((resolve, reject) => {
        connectionMoodle.query(
            'SELECT id, name, timeopen, timeclose, timelimit FROM mdl_quiz WHERE course = ?', 
            [courseId],
            (error, results) => {
                if (error) {
                    console.error('Error en traerQuiz:', error);
                    return reject({
                        error: true,
                        data: error.message
                    });
                }
                resolve({
                    error: false,
                    data: results
                });
            }
        );
    });
}


app.post('/getCourseContents', async (req, res) => {
    const { courseId } = req.body.data;
    try {
        const response = await getCourseContents(courseId);

        if (response.error) {
            return res.json({
                error: true,
                respuesta: 'Error getCourseContents',
                detalles: response.data
            });
        } else {
            return res.json({
                error: false,
                respuesta: 'getCourseContents exitosa',
                data: response
            });
        }
    } catch (error) {
        console.error("Error en la API de Node.js:", error);
        res.json({
            error: true,
            respuesta: 'Error en la API de Node.js: ' + error.message
        });
    }
});
app.post('/deleteCategory', async (req, res) => {
    const { categoryId } = req.body.data;
    try {
        const response = await deleteCategory(categoryId);

        if (response.error) {
            return res.json({
                error: true,
                respuesta: 'Error al eliminar categoría',
                detalles: response.data
            });
        } else {
            return res.json({
                error: false,
                respuesta: 'categoría en Moodle eliminada exitosa',
                data: response.data
            });
        }
    } catch (error) {
        console.error("Error en la API de Node.js:", error);
        res.json({
            error: true,
            respuesta: 'Error en la API de Node.js: ' + error.message
        });
    }
});
// Endpoint para crear la categoría en Node.js
app.post('/createSubcategory', async (req, res) => {
    const { name, parentCategoryId } = req.body.data;
    console.log(name, parentCategoryId);
    try {
        const response = await createSubcategory(name,parentCategoryId );

        if (response.error) {
            return res.json({
                error: true,
                respuesta: 'Error al crear subcategoría',
                detalles: response.data
            });
        } else {
            return res.json({
                error: false,
                respuesta: 'subcategoría en Moodle creada exitosa',
                data: response.data
            });
        }
    } catch (error) {
        console.error("Error en la API de Node.js:", error);
        res.json({
            error: true,
            respuesta: 'Error en la API de Node.js: ' + error.message
        });
    }
});
app.post('/getCourseDetailsById', async (req, res) => {
    const { courseId } = req.body.data;
    console.log(courseId);
    console.log('getCourseDetailsById');
    try {
        const response = await getCourseDetailsById(courseId);

        if (response.error) {
            return res.json({
                error: true,
                respuesta: 'Error al traer los cursos',
                detalles: response.data
            });
        } else {
            return res.json({
                error: false,
                data: response,
                respuesta: 'getCourseDetailsById exitosa'
            });
        }
    } catch (error) {
        console.error("Error en la API de Node.js:", error);
        res.json({
            error: true,
            respuesta: 'Error en la API de Node.js: ' + error.message
        });
    }
});
app.post('/getCoursesByCategoryId', async (req, res) => {
    const { categoryId } = req.body.data;
    console.log(categoryId);
    console.log('getCoursesByCategoryId');
    try {
        const response = await getCoursesByCategoryId(categoryId);

        if (response.error) {
            return res.json({
                error: true,
                respuesta: 'Error al traer los cursos',
                detalles: response.data
            });
        } else {
            return res.json({
                error: false,
                data: response,
                respuesta: 'getCoursesByCategoryId exitosa'
            });
        }
    } catch (error) {
        console.error("Error en la API de Node.js:", error);
        res.json({
            error: true,
            respuesta: 'Error en la API de Node.js: ' + error.message
        });
    }
});
app.post('/updateAssignmentDates', async (req, res) => {
    const { assignId, allowSubmissionsFromDate, dueDate, cutoffDate} = req.body.data;
    try {
        const response = await updateAssignmentDates(assignId, allowSubmissionsFromDate, dueDate, cutoffDate    );

        if (response.error) {
            return res.json({
                error: true,
                respuesta: 'Error al eliminar categoría',
                detalles: response.data
            });
        } else {
            return res.json({
                error: false,
                data: response,
                respuesta: 'getCategorias exitosa'
            });
        }
    } catch (error) {
        console.error("Error en la API de Node.js:", error);
        res.json({
            error: true,
            respuesta: 'Error en la API de Node.js: ' + error.message
        });
    }
});
app.post('/getCategories', async (req, res) => {
    const { categoryId } = req.body.data;
    try {
        const response = await getCategories(categoryId);

        if (response.error) {
            return res.json({
                error: true,
                respuesta: 'Error al eliminar categoría',
                detalles: response.data
            });
        } else {
            return res.json({
                error: false,
                data: response,
                respuesta: 'getCategorias exitosa'
            });
        }
    } catch (error) {
        console.error("Error en la API de Node.js:", error);
        res.json({
            error: true,
            respuesta: 'Error en la API de Node.js: ' + error.message
        });
    }
});
app.post('/updateCategory', async (req, res) => {
    const { categoryId, newName } = req.body.data;
    try {
        const response = await updateCategory(categoryId, newName);

        if (response.error) {
            return res.json({
                error: true,
                respuesta: 'Error al actualizar categoría',
                detalles: response.data
            });
        } else {
            return res.json({
                error: false,
                respuesta: 'Update de categoría en Moodle exitosa',
                data: response.data
            });
        }
    } catch (error) {
        console.error("Error en la API de Node.js:", error);
        res.json({
            error: true,
            respuesta: 'Error en la API de Node.js: ' + error.message
        });
    }
});
app.post('/updateCourse', async (req, res) => {
    const { courseId, newName, newShortName, newStartDate, newEndDate, moodleId, visibility } = req.body.data;
    try {
        const response = await updateCourse(courseId, newName, newShortName, newStartDate, newEndDate, moodleId, visibility);
        console.log(response);
        if (response !== 'OK') {
            return res.json({
                error: true,
                respuesta: 'Error al actualizar curso',
                data: response
            });
        } else {
            return res.json({
                error: false,
                respuesta: 'Update de curso en Moodle exitosa',
            });
        }
    } catch (error) {
        console.error("Error en la API de Node.js:", error);
        res.json({
            error: true,
            respuesta: 'Error en la API de Node.js: ' + error.message
        });
    }
});
app.post('/crearCategoria', async (req, res) => {
    const { categoryName } = req.body.data;
    try {
        const response = await createCategory(categoryName);

        if (response.error) {
            return res.json({
                error: true,
                respuesta: 'Error al crear la categoría en Moodle',
                detalles: response.data
            });
        } else {
            console.log('Creación de categoría en Moodle exitosa');
            console.log(response);
            return res.json({
                error: false,
                respuesta: 'Creación de categoría en Moodle exitosa',
                data: response.data
            });
        }
    } catch (error) {
        console.error("Error en la API de Node.js:", error);
        res.json({
            error: true,
            respuesta: 'Error en la API de Node.js: ' + error.message
        });
    }
});


// Endpoint
app.post('/deleteUserid', async (req, res) => {
    const { courseid, userid } = req.body.data;
    console.log('deleteUserid');
    try {
        // Obtener el ueid para el curso y usuario específicos
        const response = await deleteUserid(courseid, userid);
        if(response){
            return res.json({
                error: false,
                respuesta: 'Usuario desinscrito exitosamente',
                data: response.respuesta
            });
        }else{
            return res.json({
                error: true,
                respuesta: 'Usuario no se desinscrito',
              
            });
        }
       
    } catch (error) {
        console.error('Error en la API de Node.js:', error);
        res.json({
            error: true,
            respuesta: 'Error en la API de Node.js: ' + error.message
        });
    }
});


app.post('/crearCurso', async (req, res) => {
    const {courseName, idCategoria,startDate, endDate, idnumber } = req.body.data;

    try {
        // Crear categoría en Moodle
            // Crear curso en la categoría recién creada
            const course = await createCourse(
                courseName,
                idCategoria,  // ID de la categoría creada
                startDate,
                endDate, 
                idnumber
            );

            if (course) {
                return res.json({
                    error: false,
                    respuesta: 'Categoría y curso creados exitosamente',
                    data:  course
                });
            } else {
                return res.json({
                    error: true,
                    respuesta: 'Error al crear el curso en Moodle'
                });
            }
    
    } catch (error) {
        console.error("Error en la API de Node.js:", error);
        res.json({
            error: true,
            respuesta: 'Error en la API de Node.js: ' + error.message
        });
    }
});

app.listen(3000, () => {
    console.log('Servidor Node.js corriendo en el puertos 3000');
});



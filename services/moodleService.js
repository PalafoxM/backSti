// services/moodleService.js
const axios = require('axios');
const https = require('https');
const { moodleUrl, moodleToken, token_sti } = require('../config');


const axiosInstance = axios.create({
    httpsAgent: new https.Agent({
        rejectUnauthorized: false // Ignorar el certificado expirado
    })
});

// Función para editar un curso
const updateCourse = async function(courseId, newName, newShortName, newStartDate = null, newEndDate = null, moodleId = null, visibility = 1) {
    try {
        const response = await axiosInstance.get(moodleUrl, {
            params: {
                wstoken: moodleToken,
                wsfunction: 'core_course_update_courses',
                moodlewsrestformat: 'json',
                courses: [
                    {
                        id: courseId,
                        fullname: newName,
                        shortname: generateUniqueShortname(newShortName),
                        startdate: newStartDate 
                            ? Math.floor(Date.UTC(
                                new Date(newStartDate).getUTCFullYear(),
                                new Date(newStartDate).getUTCMonth(),
                                new Date(newStartDate).getUTCDate()
                              ) / 1000)
                            : undefined,
                        enddate: newEndDate 
                            ? Math.floor(Date.UTC(
                                new Date(newEndDate).getUTCFullYear(),
                                new Date(newEndDate).getUTCMonth(),
                                new Date(newEndDate).getUTCDate()
                              ) / 1000)
                            : undefined,
                        visible: visibility,
                        idnumber: moodleId // Número de ID de Moodle
                    }
                ]
            }
        });

        if (response.data && !response.data.exception) {
            console.log("Curso actualizado:", response.status);
            return response.statusText;
        } else {
            console.error("Error al actualizar el curso:", response.data);
            return null;
        }
    } catch (error) {
        console.error("Error en la petición:", error);
    }
}

// Función para obtener las categorías
async function getCategories() {
    try {
        const response = await axiosInstance.get(moodleUrl, {
            params: {
                wstoken: moodleToken,
                wsfunction: 'core_course_get_categories',
                moodlewsrestformat: 'json'
            }
        });

        if (response.data && !response.data.exception) {
            console.log("Categorías obtenidas:", response.data);
            return response.data;
        } else {
            console.error("Error al obtener categorías:", response.data);
            return null;
        }
    } catch (error) {
        console.error("Error en la petición:", error);
    }
}


// Función para eliminar un curso
async function deleteCourse(courseId) {
    try {
        const response = await axiosInstance.get(moodleUrl, {
            params: {
                wstoken: moodleToken,
                wsfunction: 'core_course_delete_courses',
                moodlewsrestformat: 'json',
                courseids: [courseId]
            }
        });

        if (response.data && !response.data.exception) {
            console.log("Curso eliminado:", response.data);
            return response.data;
        } else {
            console.error("Error al eliminar el curso:", response.data);
            return null;
        }
    } catch (error) {
        console.error("Error en la petición:", error);
    }
}



// Función para eliminar una categoría
async function deleteCategory(categoryId, deleteContents = true) {
    try {
        const response = await axiosInstance.get(moodleUrl, {
            params: {
                wstoken: moodleToken,
                wsfunction: 'core_course_delete_categories',
                moodlewsrestformat: 'json',
                categories: categoryId,
                deletecontents: deleteContents ? 1 : 0
            }
        });

        if (response.data && !response.data.exception) {
            console.log("Categoría eliminada:", response.data);
            return response.data;
        } else {
            console.error("Error al eliminar la categoría:", response.data);
            return null;
        }
    } catch (error) {
        console.error("Error en la petición:", error);
    }
}


// Función para editar una categoría
async function updateCategory(categoryId, newName, newParentId = null) {
    try {
        const response = await axiosInstance.get(moodleUrl, {
            params: {
                wstoken: moodleToken,
                wsfunction: 'core_course_update_categories',
                moodlewsrestformat: 'json',
                categories: [
                    {
                        id: categoryId,
                        name: newName,
                        parent: newParentId
                    }
                ]
            }
        });

        if (response.data && !response.data.exception) {
            console.log("Categoría actualizada:", response.data);
            return response.data;
        } else {
            console.error("Error al actualizar la categoría:", response.data);
            return null;
        }
    } catch (error) {
        console.error("Error en la petición:", error);
    }
}

async function getCoursesByCategoryId(categoryId) {
    try {
        const response = await axiosInstance.get(moodleUrl, {
            params: {
                wstoken: moodleToken,
                wsfunction: 'core_course_get_courses_by_field',
                moodlewsrestformat: 'json',
                field: 'category',
                value: categoryId
            }
        });

        if (response.data && !response.data.exception) {
            console.log("Cursos obtenidos:", response.data.courses);
            return response.data.courses;
        } else {
            console.error("Error al obtener cursos:", response.data);
            return null;
        }
    } catch (error) {
        console.error("Error en la petición:", error);
    }
}

async function getCourseDetailsById(courseId) {
    try {
        const response = await axiosInstance.get(moodleUrl, {
            params: {
                wstoken: moodleToken,
                wsfunction: 'core_course_get_courses',
                moodlewsrestformat: 'json',
                'options[ids][]': [courseId] // Enviar el ID del curso
            }
        });

        // Imprimir la respuesta completa para verificar la estructura
        console.log("Respuesta completa de la API:", response.data);

        if (response.data && Array.isArray(response.data)) {
            console.log("Cursos obtenidos:", response.data);
            return response.data; // Devuelve el array de cursos directamente
        } else {
            console.error("Error al obtener cursos o estructura inesperada:", response.data);
            return null;
        }
    } catch (error) {
        console.error('Error al obtener los detalles del curso:', error.message);
        return {
            error: true,
            message: error.message
        };
    }
}


// Función para crear una categoría
async function createCategory(categoryName, parentCategoryId = 0) {
    try {
        const response = await axiosInstance.get(moodleUrl, {
            params: {
                wstoken: moodleToken,
                wsfunction: 'core_course_create_categories',
                moodlewsrestformat: 'json',
                categories: [
                    {
                        name: categoryName,
                        parent: parentCategoryId
                    }
                ]
            }
        });

        if (response.data && !response.data.exception) {
            console.log("Categoría creada:", response.data);
            return { error: false, data: response.data };
        } else {
            console.error("Error al crear la categoría:", response.data);
            return { error: true, data: response.data };
        }
    } catch (error) {
        console.error("Error en la petición:", error);
        return { error: true, data: null, message: error.message };
    }
}


// Función para crear una categoría
/* async function createCategory(categoryName, parentCategoryId = 0) {
    try {
        const response = await axios.get(moodleUrl, {
            params: {
                wstoken: moodleToken,
                wsfunction: 'core_course_create_categories',
                moodlewsrestformat: 'json',
                categories: JSON.stringify([{
                    name: categoryName,
                    parent: parentCategoryId
                }])
            }
        });
        
        if (response.data && !response.data.exception) {
            console.log("Categoría creada:", response.data);
            return response.data;
        } else {
            console.error("Error al crear la categoría:", response.data);
            return null;
        }
    } catch (error) {
        console.error("Error en la petición:", error);
    }
} */



    async function createSubcategory(name, parentCategoryId) {
        try {
            console.log(name, parentCategoryId);
            const response = await axiosInstance.get(moodleUrl, {
                params: {
                    wstoken: moodleToken,
                    wsfunction: 'core_course_create_categories',
                    moodlewsrestformat: 'json',
                    categories: [
                        {
                            name: name,
                            parent: parentCategoryId
                        }
                    ]
                }
            });
    
            if (response.data && !response.data.exception) {
                console.log("Subcategoría creada:", response.data);
                return response.data;
            } else {
                console.error("Error al crear la subcategoría:", response.data);
                return null;
            }
        } catch (error) {
            console.error("Error en la petición:", error);
        }
    }
// Función para crear un curso (usando axiosInstance para evitar el error SSL)
async function createCourse(courseName, categoryId, startDate, endDate, idnumber ) {
    try {
        const response = await axiosInstance.get(moodleUrl, {
            params: {
                wstoken: moodleToken,
                wsfunction: 'core_course_create_courses',
                moodlewsrestformat: 'json',
                courses: [
                    {
                        fullname: courseName,
                        shortname: generateUniqueShortname(courseName),
                        categoryid: categoryId,
                        startdate: Math.floor(new Date(startDate).getTime() / 1000),
                        enddate: Math.floor(new Date(endDate).getTime() / 1000),
                        visible: 1,
                        idnumber: idnumber
                    }
                ]
            }
        });

        if (response.data && !response.data.exception) {
            console.log("Curso creado:", response.data);
            return response.data;
        } else {
            console.error("Error al crear el curso:", response.data);
            return null;
        }
    } catch (error) {
        console.error("Error en la petición:", error);
    }
}

async function updateAssignmentDates(assignId, allowSubmissionsFromDate, dueDate, cutoffDate) {
    try {
        const response = await axios.get(moodleUrl, {
            params: {
                wstoken: moodleToken,
                wsfunction: 'mod_assign_update_assignment',
                moodlewsrestformat: 'json',
                assignmentid: assignId,
                allowsubmissionsfromdate: Math.floor(new Date(allowSubmissionsFromDate).getTime() / 1000),
                duedate: Math.floor(new Date(dueDate).getTime() / 1000),
                cutoffdate: Math.floor(new Date(cutoffDate).getTime() / 1000),
            }
        });

        if (response.data && !response.data.exception) {
            console.log("Fechas de la tarea actualizadas:", response.data);
            return response.data;
        } else {
            console.error("Error al actualizar fechas de la tarea:", response.data);
            return null;
        }
    } catch (error) {
        console.error("Error en la petición:", error);
    }
}



async function getCourseContents(courseId) {
    try {
        const response = await axiosInstance.get(moodleUrl, {
            params: {
                wstoken: moodleToken,
                wsfunction: 'core_course_get_contents',
                moodlewsrestformat: 'json',
                courseid: courseId
            }
        });

        if (response.data && !response.data.exception) {
            console.log("Contenidos del curso obtenidos:", response.data);
            return response.data;
        } else {
            console.error("Error al obtener contenidos del curso:", response.data);
            return null;
        }
    } catch (error) {
        console.error("Error en la petición:", error);
    }
}

function generateUniqueShortname(courseName) {
    // Generar un sufijo aleatorio de 5 caracteres
    const randomSuffix = Math.random().toString(36).substring(2, 7); // Genera una cadena aleatoria de 5 caracteres
    const shortname = `${courseName.replace(/\s+/g, '_').toLowerCase()}_${randomSuffix}`;
    return shortname;
}

async function crearCursosDesdeCSV(courseName, categoryId, startDate, endDate, idnumber) {
    console.log(courseName, categoryId, startDate, endDate, idnumber);
    try {
        const response = await axiosInstance.get(moodleUrl, {
            params: {
                wstoken: moodleToken,
                wsfunction: 'core_course_create_courses',
                moodlewsrestformat: 'json',
                courses: [
                    {
                        fullname: courseName,
                        shortname: generateUniqueShortname(courseName),
                        categoryid: categoryId,
                        startdate: Math.floor(new Date(startDate).getTime() / 1000),
                        enddate: Math.floor(new Date(endDate).getTime() / 1000),
                        idnumber: idnumber, 
                    }
                ]
            }
        });

        if (response.data && !response.data.exception) {
            console.log("Curso creado:", response.data);
            return response.data;
        } else {
            console.error("Error al crear el curso:", response.data);
            return null;

        }
    } catch (error) {
        console.error("Error en la petición:", error);
    }
}


// 1. Verificar si el usuario ya existe en Moodle y obtener su userid
async function verificarUsuarios(usuarios) {
    const usuariosExistentes = [];
    console.log('Verificando usuarios en Moodle...');
    for (const usuario of usuarios) {
        try {
            const username = usuario.curp.toLowerCase();
            console.log(username);
            const response = await axiosInstance.get(moodleUrl, {
                params: {
                    wstoken: moodleToken,
                    wsfunction: 'core_user_get_users_by_field',
                    moodlewsrestformat: 'json',
                    field: 'username',
                    values: [username]  // Utiliza la CURP como `username`
                }
            });

            if (response.data && response.data.length > 0) {
                // Usuario encontrado, guarda su `userid` en Moodle
                usuariosExistentes.push({ ...usuario, existe: true, userid: response.data[0].id });
            } else {
                // Usuario no encontrado
                usuariosExistentes.push({ ...usuario, existe: false,  });
            }
        } catch (error) {
            console.error(`Error al verificar el usuario ${usuario.curp}:`, error.message);
        }
    }
    
    return usuariosExistentes;
}

// 2. Crear usuarios que no existan y obtener sus `userid`
async function crearUsuarios(usuarios) {
    const usuariosACrear = usuarios.filter(usuario => !usuario.existe);
    const usuariosCreados = [];
    console.log('Creando usuarios en Moodle...');
    for (const usuario of usuariosACrear) {
        try {
            const response = await axiosInstance.post(moodleUrl, null, {
                params: {
                    wstoken: moodleToken,
                    wsfunction: 'core_user_create_users',
                    moodlewsrestformat: 'json',
                    users: [{
                        username: usuario.curp.toLowerCase(),
                        password: usuario.curp,  // Contraseña como el CURP
                        firstname: usuario.nombre,
                        lastname: `${usuario.primer_apellido} ${usuario.segundo_apellido}`,
                        email: usuario.correo,
                        auth: 'manual'
                    }]
                }
            });
             console.log(response.data);
            if (response.data && response.data.length > 0) {
                const nuevoUsuario = response.data[0];
                usuariosCreados.push({ ...usuario, existe: true, userid: nuevoUsuario.id });
            }
        } catch (error) {
            console.error(`Error al crear usuario ${usuario.curp}:`, error.message);
        }
    }

    return usuariosCreados;
}

// 3. Matricular usuarios en el curso de Moodle utilizando `userid`
async function matricularUsuarios(usuarios, courseId) {
    const matriculados = [];
    console.log(usuarios);
    for (const usuario of usuarios) {
        try {
            if (!usuario.userid) continue; // Saltar usuarios sin `userid`
            const response = await axiosInstance.post(moodleUrl, null, {
                params: {
                    wstoken: moodleToken,
                    wsfunction: 'enrol_manual_enrol_users',
                    moodlewsrestformat: 'json',
                    enrolments: [{
                        roleid: 5,         // ID del rol de estudiante
                        userid: usuario.userid,  // ID del usuario en Moodle
                        courseid: courseId
                    }]
                }
            });
            console.log(response.data);
            if (response.data) {
                matriculados.push({ ...usuario, matriculado: true });
            }
        } catch (error) {
            console.error(`Error al matricular usuario ${usuario.curp}:`, error.message);
        }
    }
    return matriculados;
}

// Función principal para matricular en Moodle
async function matricularEnMoodle(usuarios, courseId) {
    try {
        // Paso 1: Verificar existencia y obtener `userid` de usuarios existentes
        const usuariosVerificados = await verificarUsuarios(usuarios);
        console.log("Usuarios verificados:", usuariosVerificados);

        // Paso 2: Crear usuarios no existentes y obtener sus `userid`
        const nuevosUsuarios = await crearUsuarios(usuariosVerificados);
        console.log("Usuarios creados:", nuevosUsuarios);

        const todosUsuarios = [...usuariosVerificados, ...nuevosUsuarios];
        console.log("Todos los usuarios:", todosUsuarios);

        // Paso 3: Matricular usuarios en curso con `userid` en `enrolments`
        const matriculados = await matricularUsuarios(todosUsuarios, courseId);
        console.log("Usuarios matriculados:", matriculados);

        // Retorna un objeto JSON que contiene todos los detalles de la matrícula
        return {
            error: false,
            respuesta: "Proceso de matrícula completado",
            data : {usuariosVerificados: usuariosVerificados,  nuevosUsuarios: nuevosUsuarios, matriculados: matriculados },
        };
    } catch (error) {
        console.error("Error en el proceso de matriculación:", error.message);
        return {
            error: true,
            respuesta: "Error en el proceso de matriculación: " + error.message
        };
    }
}


async function deleteUserid(courseid, userid) {
    try {
        const response = await axiosInstance.post(moodleUrl, null, {
            params: {
                wstoken: moodleToken,
                wsfunction: 'enrol_manual_unenrol_users',
                moodlewsrestformat: 'json',
                enrolments: [{
                    roleid: 5,         // ID del rol de estudiante
                    userid:userid,  // ID del usuario en Moodle
                    courseid: courseid
                }]
            }
         
        });

        if (response.status === 200) {
            console.log("Usuario desinscrito exitosamente:", response.statusText);
            return {
                error: true,
                respuesta: "Usuario desinscrito exitosamente:"
            };
        } else {
            console.error("Error en la solicitud:", response.statusText);
            return null;
        }
    } catch (error) {
        console.error('Error al desinscribir usuario:', error.response?.data || error.message);
        return null;
    }
}





module.exports = {
    createCategory,
    createCourse,
    updateCourse,
    deleteCourse,
    updateCategory,
    deleteCategory,
    getCategories,
    getCoursesByCategoryId,
    createSubcategory,
    getCourseContents,
    updateAssignmentDates,
    crearCursosDesdeCSV,
    getCourseDetailsById,
    matricularEnMoodle,
    deleteUserid,
   
};



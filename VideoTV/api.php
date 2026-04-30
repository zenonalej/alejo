<?php
header('Content-Type: application/json');

// 1. Leer videos de la carpeta media
$directory = 'media/';
$videos = glob($directory . "*.{mp4,webm,ogg}", GLOB_BRACE);

// 2. Leer configuración de la marquesina
$config = json_decode(file_get_contents('config.json'), true);

// 3. Unificar respuesta
$response = [
    "playlist" => $videos,
    "branding" => $config["branding"]
];

echo json_encode($response);
?>
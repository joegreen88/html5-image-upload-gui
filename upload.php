<?php
echo json_encode(array(
    'id' => $_POST['id'],
    'file' => array_shift($_FILES)
));
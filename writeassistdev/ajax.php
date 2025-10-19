<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Simplified AJAX handler for writeassistdev module
 * Directly calls lib.php functions without unnecessary validation layers
 * @package    mod_writeassistdev
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once('../../config.php');
require_once($CFG->dirroot . '/mod/writeassistdev/lib.php');

// Basic AJAX request check
if (!isset($_SERVER['HTTP_X_REQUESTED_WITH']) || strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) !== 'xmlhttprequest') {
    http_response_code(403);
    die('Direct access not allowed');
}

// Get parameters
$action = required_param('action', PARAM_ALPHANUMEXT);
$cmid = required_param('cmid', PARAM_INT);
$sesskey = required_param('sesskey', PARAM_ALPHANUM);

// Verify session key
if (!confirm_sesskey($sesskey)) {
    http_response_code(403);
    die('Invalid session key');
}

// Get course module and context
$cm = get_coursemodule_from_id('writeassistdev', $cmid, 0, false, MUST_EXIST);
$course = $DB->get_record('course', array('id' => $cm->course), '*', MUST_EXIST);
$writeassistdev = $DB->get_record('writeassistdev', array('id' => $cm->instance), '*', MUST_EXIST);

// Set up context
$context = context_module::instance($cm->id);
require_login($course, true, $cm);
require_capability('mod/writeassistdev:view', $context);

// Set JSON header
header('Content-Type: application/json');

try {
    switch ($action) {
        case 'save_project':
            $projectdata = required_param('project_data', PARAM_RAW);
            $success = writeassistdev_save_project($writeassistdev->id, $USER->id, $projectdata);
            echo json_encode(['success' => $success]);
            break;
            
        case 'load_project':
            $projectdata = writeassistdev_load_project($writeassistdev->id, $USER->id);
            if ($projectdata !== false) {
                $decoded = json_decode($projectdata, true);
                echo json_encode(['success' => true, 'project' => $decoded]);
            } else {
                echo json_encode(['success' => true, 'project' => null]);
            }
            break;
            
        case 'delete_project':
            $success = writeassistdev_delete_project($writeassistdev->id, $USER->id);
            echo json_encode(['success' => $success]);
            break;
            
        default:
            throw new Exception('Invalid action');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
} 
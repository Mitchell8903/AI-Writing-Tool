<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Library functions for the writeassistdev module
 * @package    mod_writeassistdev
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

/**
 * Adds a new instance of the writeassistdev module.
 *
 * @param stdClass $data An object from the form in mod_form.php
 * @param mod_writeassistdev_mod_form $form The form instance (optional).
 * @return int The id of the newly inserted writeassistdev record
 */
function writeassistdev_add_instance($data, $form) {
    global $DB, $COURSE;

    // Set default course if not provided.
    if (empty($data->course)) {
        $data->course = $COURSE->id;
    }

    // Set timestamps.
    $data->timecreated = time();
    $data->timemodified = time();

    // Handle intro field if present.
    if (isset($data->intro)) {
        $data->introformat = $data->intro['format'];
        $data->intro = $data->intro['text'];
    }

    // Handle template field
    if (empty($data->template)) {
        $data->template = 'argumentative'; // Default template
    }

    // Insert the new writeassistdev instance.
    $data->id = $DB->insert_record('writeassistdev', $data);

    return $data->id;
}

/**
 * Updates an existing instance of the writeassistdev module.
 *
 * Given an object containing all the necessary data (defined in the form),
 * this function will update an existing instance with new data.
 *
 * @param stdClass $data An object from the form in mod_form.php
 * @param mod_writeassistdev_mod_form $form The form instance (optional).
 * @return boolean Success/Failure
 */
function writeassistdev_update_instance($data, $form) {
    global $DB;

    $data->timemodified = time();
    $data->id = $data->instance;

    // Handle intro field if present.
    if (isset($data->intro)) {
        $data->introformat = $data->intro['format'];
        $data->intro = $data->intro['text'];
    }

    // Handle template field
    if (empty($data->template)) {
        $data->template = 'argumentative'; // Default template
    }

    $DB->update_record('writeassistdev', $data);

    return true;
}

/**
 * Deletes an instance of the writeassistdev module from the database.
 *
 * Given an ID of an instance of this module, this function will
 * permanently delete the instance and any data that depends on it.
 *
 * @param int $id Id of the module instance
 * @return boolean Success/Failure
 */
function writeassistdev_delete_instance($id) {
    global $DB;

    if (!$writeassistdev = $DB->get_record('writeassistdev', ['id' => $id])) {
        return false;
    }

    // Delete related work records.
    if ($DB->record_exists('writeassistdev_work', ['writeassistdevid' => $id])) {
        $DB->delete_records('writeassistdev_work', ['writeassistdevid' => $id]);
    }

    // Delete files.
    try {
        $cm = get_coursemodule_from_instance('writeassistdev', $id, $writeassistdev->course, false, MUST_EXIST);
        $context = context_module::instance($cm->id);
    } catch (Exception $e) {
        debugging("Course module record not found in writeassistdev_delete_instance; using course context. Error: " . $e->getMessage(), DEBUG_DEVELOPER);
        $context = context_course::instance($writeassistdev->course);
    }
    $fs = get_file_storage();
    $fs->delete_area_files($context->id);

    $DB->delete_records('writeassistdev', ['id' => $id]);

    return true;
}

/**
 * Returns the icon URL for the writeassistdev module.
 *
 * @return string The icon URL
 */
function writeassistdev_get_icon() {
    global $CFG;
    return $CFG->wwwroot . '/mod/writeassistdev/pix/icon.png';
}

/**
 * Returns a list of view actions for the writeassistdev module.
 *
 * @param stdClass $writeassistdev
 * @return array of strings
 */
function writeassistdev_get_view_actions() {
    return array('view');
}

/**
 * Returns a list of post actions for the writeassistdev module.
 *
 * @param stdClass $writeassistdev
 * @return array of strings
 */
function writeassistdev_get_post_actions() {
    return array('add', 'update');
}

/**
 * Extends the global navigation tree by adding writeassistdev nodes if there is a corresponding capability.
 *
 * @param navigation_node $writeassistdevnode
 * @param stdClass $course
 * @param stdClass $cm
 * @param cm_info $writeassistdev
 */
function writeassistdev_extend_navigation(navigation_node $writeassistdevnode, stdClass $course, stdClass $cm, cm_info $writeassistdev) {
    // Add navigation items here if needed.
}

/**
 * Extends the settings navigation with the writeassistdev settings.
 *
 * @param settings_navigation $settingsnav
 * @param navigation_node $writeassistdevnode
 */
function writeassistdev_extend_settings_navigation(settings_navigation $settingsnav, navigation_node $writeassistdevnode) {
    // Add settings navigation items here if needed.
}

/**
 * Returns a list of page types for the writeassistdev module.
 *
 * @param string $pagetype Current page type
 * @param stdClass $parentcontext Block's parent context
 * @param stdClass $currentcontext Current context of block
 * @return array
 */
function writeassistdev_page_type_list($pagetype, $parentcontext, $currentcontext) {
    $module_pagetype = array('mod-writeassistdev-*' => get_string('page-mod-writeassistdev-x', 'mod_writeassistdev'));
    return $module_pagetype;
}

/**
 * Checks if the module has any updates that should be applied to the course.
 *
 * @param cm_info $cm
 * @param int $from
 * @param array $filter
 * @return array
 */
function writeassistdev_check_updates_since(cm_info $cm, $from, $filter = array()) {
    $updates = array();
    return $updates;
}

/**
 * Returns the FontAwesome icon map for the writeassistdev module.
 *
 * @return array
 */
function writeassistdev_get_fontawesome_icon_map() {
    return array(
        'mod_writeassistdev:icon' => 'fa-pencil',
    );
}

/**
 * Save project data to database
 * @param int $writeassistdevid The activity instance ID
 * @param int $userid The user ID
 * @param string $projectdata JSON string of project data
 * @return bool Success status
 */
function writeassistdev_save_project($writeassistdevid, $userid, $projectdata) {
    global $DB;
    
    // Basic validation
    if (empty($writeassistdevid) || empty($userid) || empty($projectdata)) {
        return false;
    }
    
    // Check if record exists
    $record = $DB->get_record('writeassistdev_work', 
        array('writeassistdevid' => $writeassistdevid, 'userid' => $userid));
    
    $data = array(
        'writeassistdevid' => $writeassistdevid,
        'userid' => $userid,
        'content' => $projectdata,
        'timemodified' => time()
    );
    
    if ($record) {
        // Update existing record
        $data['id'] = $record->id;
        return $DB->update_record('writeassistdev_work', $data);
    } else {
        // Create new record
        $data['timecreated'] = time();
        return $DB->insert_record('writeassistdev_work', $data);
    }
}

/**
 * Load project data from database
 * @param int $writeassistdevid The activity instance ID
 * @param int $userid The user ID
 * @return string|false JSON string of project data or false if not found
 */
function writeassistdev_load_project($writeassistdevid, $userid) {
    global $DB;
    
    // Basic validation
    if (empty($writeassistdevid) || empty($userid)) {
        return false;
    }
    
    $record = $DB->get_record('writeassistdev_work', 
        array('writeassistdevid' => $writeassistdevid, 'userid' => $userid));
    
    return $record ? $record->content : false;
}

/**
 * Delete project data from database
 * @param int $writeassistdevid The activity instance ID
 * @param int $userid The user ID
 * @return bool Success status
 */
function writeassistdev_delete_project($writeassistdevid, $userid) {
    global $DB;
    
    return $DB->delete_records('writeassistdev_work', 
        array('writeassistdevid' => $writeassistdevid, 'userid' => $userid));
}

/**
 * Returns additional information for module being displayed in course.
 *
 * @param cm_info $coursemodule
 * @return cached_cm_info|null
 */
function writeassistdev_get_coursemodule_info($coursemodule) {
    global $DB;

    if ($writeassistdev = $DB->get_record('writeassistdev', array('id' => $coursemodule->instance), 'id, name, intro, introformat')) {
        $info = new cached_cm_info();
        $info->name = $writeassistdev->name;
        if ($coursemodule->showdescription) {
            $info->content = format_module_intro('writeassistdev', $writeassistdev, $coursemodule->id, false);
        }
        return $info;
    } else {
        return null;
    }
}


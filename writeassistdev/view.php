<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * AI Writing Assistant view page
 * @package    mod_writeassistdev
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once('../../config.php');
require_once($CFG->dirroot . '/mod/writeassistdev/lib.php');
require_once($CFG->dirroot . '/mod/writeassistdev/version.php');



$id = required_param('id', PARAM_INT);

if (!$cm = get_coursemodule_from_id('writeassistdev', $id, 0, false, MUST_EXIST)) {
    print_error('invalidcoursemodule');
}

$course = $DB->get_record('course', array('id' => $cm->course), '*', MUST_EXIST);
$instance = $DB->get_record('writeassistdev', ['id' => $cm->instance], '*', MUST_EXIST);

require_login($course, true, $cm);

$context = context_module::instance($cm->id);
require_capability('mod/writeassistdev:view', $context);

$PAGE->set_url(new moodle_url('/mod/writeassistdev/view.php', ['id' => $cm->id]));
$PAGE->set_title(format_string($instance->name));
$PAGE->set_heading(format_string($course->fullname));
$PAGE->set_context($context);
$PAGE->set_pagelayout('popup'); // Use popup layout for full-page experience


// Multi-level cache busting strategy for web server, Moodle, and browser levels

// 1. Plugin version for cache busting
$pluginversion = $plugin->version;

// 2. File hash-based cache busting (simple and reliable)
$cssStylesHash = md5_file($CFG->dirroot . '/mod/writeassistdev/styles/styles.css');
$cssQuillHash = md5_file($CFG->dirroot . '/mod/writeassistdev/styles/quill-editor.css');
$jsMainHash = md5_file($CFG->dirroot . '/mod/writeassistdev/scripts/main.js');
$jsApiHash = md5_file($CFG->dirroot . '/mod/writeassistdev/scripts/api.js');
$jsDomHash = md5_file($CFG->dirroot . '/mod/writeassistdev/scripts/dom.js');
$jsUtilsHash = md5_file($CFG->dirroot . '/mod/writeassistdev/scripts/utils.js');

// 3. Simple cache busters: plugin version + file hash
$jsMainCacheBuster = $pluginversion . '_' . substr($jsMainHash, 0, 8);
$jsApiCacheBuster = $pluginversion . '_' . substr($jsApiHash, 0, 8);
$jsDomCacheBuster = $pluginversion . '_' . substr($jsDomHash, 0, 8);
$jsUtilsCacheBuster = $pluginversion . '_' . substr($jsUtilsHash, 0, 8);
$cssStylesCacheBuster = $pluginversion . '_' . substr($cssStylesHash, 0, 8);
$cssQuillCacheBuster = $pluginversion . '_' . substr($cssQuillHash, 0, 8);

// 4. Set basic cache control headers
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0, private");
header("Pragma: no-cache");
header("Expires: 0");

// Load CSS files with robust cache busting
$PAGE->requires->css(new moodle_url('https://cdn.quilljs.com/1.3.7/quill.snow.css'));

// Add custom CSS with simplified cache busting
$cssStylesUrl = new moodle_url('/mod/writeassistdev/styles/styles.css?v=' . $cssStylesCacheBuster);
$cssQuillUrl = new moodle_url('/mod/writeassistdev/styles/quill-editor.css?v=' . $cssQuillCacheBuster);

// Load CSS files with simplified cache busting
$PAGE->requires->css($cssStylesUrl);
$PAGE->requires->css($cssQuillUrl);

// Load external JavaScript libraries
$PAGE->requires->js(new moodle_url('https://cdn.quilljs.com/1.3.7/quill.min.js'), true);
$PAGE->requires->js(new moodle_url('https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js'), true);

// Log the view event
$event = \mod_writeassistdev\event\course_module_viewed::create([
    'objectid' => $instance->id,
    'context'  => $context,
]);
$event->add_record_snapshot('course_modules', $cm);
$event->add_record_snapshot('course', $course);
$event->add_record_snapshot('writeassistdev', $instance);
$event->trigger();

echo $OUTPUT->header();

// Remove intro box and other Moodle elements for full-page experience
?>
<div class="app-container">
    <!-- AI Chat Section -->
    <div class="chat-section">
        <div class="chat-header">
            <h2><?php echo get_string('ai_writing_assistant', 'mod_writeassistdev'); ?></h2>
        </div>
        <div class="chat-messages" id="chatMessages">
            <!-- Chat messages will be inserted here -->
        </div>
        <div class="chat-actions-row">
            <button id="regenerateGlobalBtn" class="regenerate-global-btn" title="<?php echo get_string('regenerate_response', 'mod_writeassistdev'); ?>">
                <?php echo get_string('regenerate', 'mod_writeassistdev'); ?>
            </button>
        </div>
        <div class="chat-input">
            <textarea id="userInput" placeholder="<?php echo get_string('ask_for_help', 'mod_writeassistdev'); ?>"></textarea>
            <button id="sendMessage"><?php echo get_string('send', 'mod_writeassistdev'); ?></button>
        </div>
    </div>
    <!-- Activities Section -->
    <div class="activities-section">
        <div class="tabs">
            <button class="tab-btn active" data-tab="plan"><?php echo get_string('plan_organize', 'mod_writeassistdev'); ?></button>
            <button class="tab-btn" data-tab="write"><?php echo get_string('write', 'mod_writeassistdev'); ?></button>
            <button class="tab-btn" data-tab="edit"><?php echo get_string('edit_revise', 'mod_writeassistdev'); ?></button>
            <div class="action-buttons">
                <button class="action-btn save-btn" id="saveBtn">Save</button>
                <button class="action-btn save-exit-btn" id="saveExitBtn">Save & Exit</button>
                <button class="action-btn exit-btn" id="exitBtn">Exit</button>
            </div>
        </div>
        <!-- Plan & Organize Tab -->
        <div class="tab-content active" id="plan">
            <?php if (!empty($instance->intro)): ?>
            <div class="module-description">
                <div class="description-content">
                    <?php echo format_text($instance->intro, $instance->introformat, array('context' => $context)); ?>
                </div>
            </div>
            <?php endif; ?>
            <div class="idea-bubbles-section">
                <div class="idea-dropzone" id="brainstormDropzone">
                    <h3><?php echo get_string('brainstorm', 'mod_writeassistdev'); ?></h3>
                    <div class="bubble-actions-container">
                        <button id="addIdeaBubble"><?php echo get_string('add_idea', 'mod_writeassistdev'); ?></button>
                    </div>
                    <div class="idea-bubbles" id="ideaBubbles"></div>
                </div>
                <div class="outline-dropzone" id="outlineDropzone">
                    <h3><?php echo get_string('outline', 'mod_writeassistdev'); ?></h3>
                    <div class="outline-items" id="outlineItems"></div>
                </div>
            </div>
        </div>
        <!-- Write Tab -->
        <div id="write" class="tab-content">
            <div class="write-flex-container">
                <div class="outline-sidebar" id="outlineSidebar">
                    <h3><?php echo get_string('my_outline', 'mod_writeassistdev'); ?></h3>
                </div>
                <div class="write-editor-container">
                    <div id="writeToolbar"></div>
                    <div id="writeEditor"></div>
                </div>
            </div>
        </div>
        <!-- Edit & Revise Tab -->
        <div class="tab-content" id="edit">
            <div id="editEditor"></div>
        </div>
    </div>
</div>

<!-- Preload all JavaScript modules with simplified cache busting -->
<link rel="modulepreload" href="<?php echo $CFG->wwwroot; ?>/mod/writeassistdev/scripts/utils.js?v=<?php echo $jsUtilsCacheBuster; ?>">
<link rel="modulepreload" href="<?php echo $CFG->wwwroot; ?>/mod/writeassistdev/scripts/api.js?v=<?php echo $jsApiCacheBuster; ?>">
<link rel="modulepreload" href="<?php echo $CFG->wwwroot; ?>/mod/writeassistdev/scripts/dom.js?v=<?php echo $jsDomCacheBuster; ?>">

<!-- Load all JavaScript modules with simplified version strings -->
<script type="module" src="<?php echo $CFG->wwwroot; ?>/mod/writeassistdev/scripts/utils.js?v=<?php echo $jsUtilsCacheBuster; ?>"></script>
<script type="module" src="<?php echo $CFG->wwwroot; ?>/mod/writeassistdev/scripts/api.js?v=<?php echo $jsApiCacheBuster; ?>"></script>
<script type="module" src="<?php echo $CFG->wwwroot; ?>/mod/writeassistdev/scripts/dom.js?v=<?php echo $jsDomCacheBuster; ?>"></script>
<script type="module" src="<?php echo $CFG->wwwroot; ?>/mod/writeassistdev/scripts/main.js?v=<?php echo $jsMainCacheBuster; ?>"></script>

<script>
// Pass the instructor-selected template to the JavaScript modules
window.selectedTemplate = <?php echo json_encode($instance->template ?: 'argumentative'); ?>;
window.instructorDescription = <?php echo json_encode($instance->intro ?: ''); ?>;
window.cmId = <?php echo $cm->id; ?>;
window.courseId = <?php echo $course->id; ?>;
window.sesskey = <?php echo json_encode(sesskey()); ?>;
window.ajaxUrl = <?php echo json_encode($CFG->wwwroot . '/mod/writeassistdev/ajax.php'); ?>;
window.apiEndpoint = <?php 
    $api_endpoint = get_config('mod_writeassistdev', 'api_endpoint');
    echo ($api_endpoint === false || empty(trim($api_endpoint))) ? 'null' : json_encode($api_endpoint);
?>;

// Simplified version information
window.versionInfo = {
    plugin_version: '<?php echo $pluginversion; ?>',
    files: {
        main: {
            version: '<?php echo $jsMainCacheBuster; ?>',
            hash: '<?php echo substr($jsMainHash, 0, 8); ?>'
        },
        api: {
            version: '<?php echo $jsApiCacheBuster; ?>',
            hash: '<?php echo substr($jsApiHash, 0, 8); ?>'
        },
        dom: {
            version: '<?php echo $jsDomCacheBuster; ?>',
            hash: '<?php echo substr($jsDomHash, 0, 8); ?>'
        },
        utils: {
            version: '<?php echo $jsUtilsCacheBuster; ?>',
            hash: '<?php echo substr($jsUtilsHash, 0, 8); ?>'
        }
    }
};

// Cache busting configuration for all scripts
window.cacheBusters = {
    main: '<?php echo $jsMainCacheBuster; ?>',
    api: '<?php echo $jsApiCacheBuster; ?>',
    dom: '<?php echo $jsDomCacheBuster; ?>',
    utils: '<?php echo $jsUtilsCacheBuster; ?>'
};

// Display version information in console
console.log('=== AI Writing Assistant - Version Info ===');
console.log('Plugin Version:', window.versionInfo.plugin_version);
console.log('File Versions:', window.versionInfo.files);
console.log('==========================================');

console.log('Selected template from PHP:', window.selectedTemplate);
console.log('Instructor description:', window.instructorDescription);
console.log('CM ID:', window.cmId);
console.log('Course ID:', window.courseId);
console.log('Sesskey:', window.sesskey);
console.log('AJAX URL:', window.ajaxUrl);
console.log('API Endpoint:', window.apiEndpoint);
console.log('Cache busters:', window.cacheBusters);
</script>

<?php
echo $OUTPUT->footer();
?>

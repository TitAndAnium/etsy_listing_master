<?php
/**
 * Shortcode: [etsy_ai_generator_v2]
 * 
 * Embed de v2 SPA via iframe voor Firebase Auth + wallet functionaliteit.
 * Legacy shortcode [etsy_ai_generator] blijft ongewijzigd (HMAC-flow).
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Render v2 iframe shortcode
 * 
 * @param array $atts Shortcode attributes
 * @return string HTML output
 */
function etsy_ai_generator_v2_shortcode($atts) {
    // Parse shortcode attributes
    $atts = shortcode_atts([
        'height' => '900',
        'width' => '100%',
        'url' => 'https://sellsiren.com/generator', // Default SPA URL
    ], $atts, 'etsy_ai_generator_v2');

    $iframe_url = esc_url($atts['url']);
    $iframe_height = esc_attr($atts['height']);
    $iframe_width = esc_attr($atts['width']);

    // Build iframe HTML
    $html = '<div class="etsy-ai-generator-v2-wrapper" style="width: 100%; overflow: hidden;">';
    $html .= sprintf(
        '<iframe 
            src="%s" 
            width="%s" 
            height="%s" 
            frameborder="0"
            allow="clipboard-write"
            loading="lazy"
            style="border: none; display: block; margin: 0 auto;"
            title="Etsy AI Listing Generator"
        ></iframe>',
        $iframe_url,
        $iframe_width,
        $iframe_height . 'px'
    );
    $html .= '</div>';

    return $html;
}

add_shortcode('etsy_ai_generator_v2', 'etsy_ai_generator_v2_shortcode');

/**
 * Flatsome UX Builder element voor v2 iframe
 */
function etsy_ai_add_ux_element_v2() {
    if (!function_exists('add_ux_builder_shortcode')) {
        return; // Flatsome niet actief
    }

    add_ux_builder_shortcode('etsy_ai_generator_v2', [
        'name' => __('Etsy AI Generator v2 (iframe)', 'etsy-ai-listing'),
        'category' => __('Content', 'etsy-ai-listing'),
        'thumbnail' => '', // Optioneel: icon URL
        'info' => '{{ height }}px iframe',
        'options' => [
            'url' => [
                'type' => 'textfield',
                'heading' => 'SPA URL',
                'default' => 'https://sellsiren.com/generator',
                'description' => 'URL van deployed v2 frontend',
            ],
            'height' => [
                'type' => 'slider',
                'heading' => 'Height',
                'default' => 900,
                'min' => 400,
                'max' => 1500,
                'step' => 50,
                'unit' => 'px',
            ],
        ],
    ]);
}

add_action('ux_builder_setup', 'etsy_ai_add_ux_element_v2');

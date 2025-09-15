<?php
/**
 * Plugin Name: Etsy AI Listing (Connector)
 * Description: Connects to AI listing generator via signed requests. Provides shortcode [etsy_ai_generator].
 * Version: 0.1.0
 */

// Admin menu & settings page
add_action('admin_menu', function () {
  add_options_page(
    'Etsy AI Listing', 'Etsy AI Listing', 'manage_options', 'etsy-ai-listing',
    function () {
      ?>
      <div class="wrap">
        <h1>Etsy AI Listing – Settings</h1>
        <form method="post" action="options.php">
          <?php
            settings_fields('etsy_ai_listing');
            do_settings_sections('etsy_ai_listing');
            submit_button();
          ?>
        </form>
      </div>
      <?php
    }
  );
});

// Register settings
add_action('admin_init', function () {
  register_setting('etsy_ai_listing', 'etsy_api_base');
  register_setting('etsy_ai_listing', 'etsy_api_secret');

  add_settings_section('s1', 'API Settings', null, 'etsy_ai_listing');

  add_settings_field('etsy_api_base', 'API Base URL', function () {
    $v = esc_attr(get_option('etsy_api_base', ''));
    echo "<input type='url' name='etsy_api_base' value='$v' class='regular-text' placeholder='https://YOUR.cloudfunctions.net'>";
  }, 'etsy_ai_listing', 's1');

  add_settings_field('etsy_api_secret', 'Shared Secret', function () {
    $v = esc_attr(get_option('etsy_api_secret', ''));
    echo "<input type='password' name='etsy_api_secret' value='$v' class='regular-text'>";
  }, 'etsy_ai_listing', 's1');
});

function etsy_ai_hmac($secret, $payload) {
  return hash_hmac('sha256', $payload, $secret);
}

// REST proxy route
add_action('rest_api_init', function () {
  register_rest_route('etsy/v1', '/generate', [
    'methods'  => 'POST',
    'permission_callback' => function () { return current_user_can('edit_posts'); },
    'args' => [
      'text' => ['required' => true, 'type' => 'string'],
    ],
    'callback' => function (WP_REST_Request $req) {
      $api    = rtrim(get_option('etsy_api_base', ''), '/');
      $secret = get_option('etsy_api_secret', '');
      if (!$api || !$secret) {
        return new WP_Error('config', 'Plugin not configured', ['status' => 500]);
      }
      $uid      = get_current_user_id() ?: 0;
      $payload  = json_encode(['text' => $req['text'], 'uid' => "wpuser:$uid"], JSON_UNESCAPED_SLASHES);
      $sig      = etsy_ai_hmac($secret, $payload);
      $ts       = time();

      $resp = wp_remote_post("$api/httpGenerate", [
        'headers' => [
          'Content-Type' => 'application/json',
          'x-signature'   => $sig,
          'x-ts'          => $ts,
        ],
        'body'    => $payload,
        'timeout' => 30,
      ]);

      if (is_wp_error($resp)) {
        return new WP_Error('http_error', $resp->get_error_message(), ['status' => 500]);
      }
      $code = wp_remote_retrieve_response_code($resp);
      $body = wp_remote_retrieve_body($resp);
      return new WP_REST_Response(json_decode($body, true), $code);
    },
  ]);
});

// Shortcode
add_shortcode('etsy_ai_generator', function ($atts) {
  if (!is_user_logged_in()) return '<em>Log in to use the generator.</em>';
  $nonce = wp_create_nonce('wp_rest');
  $placeholder = $atts['placeholder'] ?? __( 'Paste raw product text…', 'etsy-ai-listing' );
  $button_text = $atts['button_text'] ?? __( 'Generate', 'etsy-ai-listing' );
  ob_start();
  ?>
  <div id="etsy-ai-box">
    <textarea id="etsy-ai-text" rows="5" style="width:100%" placeholder="<?php echo esc_attr($placeholder); ?>"></textarea>
    <p><button id="etsy-ai-run" class="button button-primary"><?php echo esc_html($button_text); ?></button></p>
    <pre id="etsy-ai-out" style="white-space:pre-wrap;background:#f6f8fa;padding:10px;border:1px solid #ddd;"></pre>
  </div>
  <script>
  (function(){
    const btn = document.getElementById('etsy-ai-run');
    const out = document.getElementById('etsy-ai-out');
    btn.addEventListener('click', async function(){
      out.textContent = 'Running...';
      const text = document.getElementById('etsy-ai-text').value || '';
      try {
        const r = await fetch('<?php echo esc_js( rest_url('etsy/v1/generate') ); ?>', {
          method: 'POST',
          headers: {'Content-Type':'application/json','X-WP-Nonce':'<?php echo esc_js($nonce); ?>'},
          body: JSON.stringify({text})
        });
        const j = await r.json();
        if (!r.ok) { out.textContent = 'Error: ' + (j && j.error ? j.error : r.status); return; }
        const f = (j.result && j.result.fields) || {};
        out.textContent =
          'TITLE:\n' + (f.title || '(n/a)') + '\n\n' +
          'TAGS:\n' + ((f.tags||[]).join(', ')) + '\n\n' +
          'DESCRIPTION:\n' + (f.description || '(n/a)');
      } catch (e) {
        out.textContent = 'Request failed: ' + e;
      }
    });
  })();
  </script>
  <?php
  return ob_get_clean();
});

// --- Flatsome UX Builder element -------------------------------------------
if ( defined( 'UX_BUILDER_VERSION' ) ) {
  add_ux_builder_shortcode( 'etsy_ai_generator', [
    'name'      => __( 'Etsy AI Generator', 'etsy-ai-listing' ),
    'category'  => __( 'Content', 'etsy-ai-listing' ),
    // Optional thumbnail; falls back to generic icon if not found
    'thumbnail' => plugin_dir_url( __FILE__ ) . 'ux-thumb.png',
    'options'   => [
      'placeholder' => [
        'type'    => 'textfield',
        'heading' => __( 'Textarea placeholder', 'etsy-ai-listing' ),
        'default' => __( 'Paste raw product text…', 'etsy-ai-listing' ),
      ],
      'button_text' => [
        'type'    => 'textfield',
        'heading' => __( 'Button label', 'etsy-ai-listing' ),
        'default' => __( 'Generate', 'etsy-ai-listing' ),
      ],
    ],
  ] );
}

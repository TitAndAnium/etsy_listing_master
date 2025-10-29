<?php
/**
 * Plugin Name: Etsy AI Listing (Connector)
 * Description: Connects to AI listing generator via signed requests. Provides shortcode [etsy_ai_generator] (legacy HMAC) and [etsy_ai_generator_v2] (iframe). Includes Flatsome UX Builder elements.
 * Version: 0.3.0
 * Author: TitAndAnium
 */

if ( ! defined( 'ABSPATH' ) ) {
  exit;
}

define( 'EAL_PLUGIN_VER', '0.2.0' );

/* ---------------- Activation sanity checks ---------------- */
register_activation_hook( __FILE__, function () {
  global $wp_version;
  if ( version_compare( PHP_VERSION, '7.4', '<' ) ) {
    deactivate_plugins( plugin_basename( __FILE__ ) );
    wp_die( 'Etsy AI Listing requires PHP 7.4 or higher. Current: ' . PHP_VERSION );
  }
  if ( version_compare( $wp_version, '5.8', '<' ) ) {
    deactivate_plugins( plugin_basename( __FILE__ ) );
    wp_die( 'Etsy AI Listing requires WordPress 5.8 or higher. Current: ' . $wp_version );
  }
} );

/* ---------------- Admin menu & settings ---------------- */
add_action( 'admin_menu', function () {
  add_options_page(
    'Etsy AI Listing', 'Etsy AI Listing', 'manage_options', 'etsy-ai-listing',
    function () {
      ?>
      <div class="wrap">
        <h1>Etsy AI Listing – Settings</h1>
        <form method="post" action="options.php">
          <?php
            settings_fields( 'etsy_ai_listing' );
            do_settings_sections( 'etsy_ai_listing' );
            submit_button();
          ?>
        </form>
      </div>
      <?php
    }
  );
} );

add_action( 'admin_init', function () {
  register_setting( 'etsy_ai_listing', 'etsy_api_base', [
    'type'              => 'string',
    'sanitize_callback' => 'esc_url_raw',
    'default'           => '',
  ] );
  register_setting( 'etsy_ai_listing', 'etsy_api_secret', [
    'type'              => 'string',
    'sanitize_callback' => function ( $v ) { return sanitize_text_field( $v ); },
    'default'           => '',
  ] );

  add_settings_section( 'eal_s1', 'API Settings', null, 'etsy_ai_listing' );

  add_settings_field( 'etsy_api_base', 'API Base URL', function () {
    $v = esc_attr( get_option( 'etsy_api_base', '' ) );
    echo "<input type='url' name='etsy_api_base' value='$v' class='regular-text' placeholder='https://us-central1-YOURPROJECT.cloudfunctions.net'>";
  }, 'etsy_ai_listing', 'eal_s1' );

  add_settings_field( 'etsy_api_secret', 'Shared Secret', function () {
    $v = esc_attr( get_option( 'etsy_api_secret', '' ) );
    echo "<input type='password' name='etsy_api_secret' value='$v' class='regular-text'>";
  }, 'etsy_ai_listing', 'eal_s1' );
} );

/* ---------------- HMAC helper ---------------- */
if ( ! function_exists( 'etsy_ai_hmac' ) ) {
  function etsy_ai_hmac( $secret, $payload ) {
    return hash_hmac( 'sha256', $payload, $secret );
  }
}

/* ---------------- REST proxy route ---------------- */
add_action( 'rest_api_init', function () {
  register_rest_route( 'etsy/v1', '/generate', [
    'methods'  => 'POST',
    'permission_callback' => function () { return current_user_can( 'edit_posts' ); },
    'args' => [
      'text' => [ 'required' => true, 'type' => 'string' ],
    ],
    'callback' => function ( WP_REST_Request $req ) {
      $api    = rtrim( get_option( 'etsy_api_base', '' ), '/' );
      $secret = get_option( 'etsy_api_secret', '' );
      if ( ! $api || ! $secret ) {
        return new WP_Error( 'config', 'Plugin not configured', [ 'status' => 500 ] );
      }
      $uid     = get_current_user_id() ?: 0;
      $payload = wp_json_encode( [ 'text' => $req->get_param( 'text' ), 'uid' => "wpuser:$uid" ], JSON_UNESCAPED_SLASHES );
      $sig     = etsy_ai_hmac( $secret, $payload );
      $ts      = time();

      $resp = wp_remote_post( "$api/httpGenerate", [
        'headers' => [
          'Content-Type' => 'application/json',
          'x-signature'   => $sig,
          'x-ts'          => $ts,
        ],
        'body'    => $payload,
        'timeout' => 30,
      ] );

      if ( is_wp_error( $resp ) ) {
        return new WP_Error( 'http_error', $resp->get_error_message(), [ 'status' => 500 ] );
      }
      $code = (int) wp_remote_retrieve_response_code( $resp );
      $body = wp_remote_retrieve_body( $resp );
      $json = json_decode( $body, true );
      if ( $json === null && json_last_error() !== JSON_ERROR_NONE ) {
        return new WP_Error( 'bad_json', 'Upstream returned non-JSON', [ 'status' => 502 ] );
      }
      return new WP_REST_Response( $json, $code );
    },
  ] );
} );

/* ---------------- Shortcode ---------------- */
add_action( 'init', function () {
  add_shortcode( 'etsy_ai_generator', function ( $atts = [] ) {
    if ( ! is_user_logged_in() ) {
      return '<em>Log in to use the generator.</em>';
    }
    $atts = shortcode_atts( [
      'placeholder' => 'Paste raw product text…',
      'button_text' => 'Generate',
    ], $atts, 'etsy_ai_generator' );

    $nonce = wp_create_nonce( 'wp_rest' );
    ob_start();
    ?>
    <div id="etsy-ai-box">
      <textarea id="etsy-ai-text" rows="5" style="width:100%" placeholder="<?php echo esc_attr( $atts['placeholder'] ); ?>"></textarea>
      <p><button id="etsy-ai-run" class="button button-primary"><?php echo esc_html( $atts['button_text'] ); ?></button></p>
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
            headers: {'Content-Type':'application/json','X-WP-Nonce':'<?php echo esc_js( $nonce ); ?>'},
            body: JSON.stringify({text})
          });
          const j = await r.json().catch(()=>null);

          // ── Graceful handling for credit exhaustion ──────────────────────
          if (r.status === 429 && j && j.code === 'CREDITS_EXHAUSTED') {
            out.textContent = 'Dagquotum opgebruikt. Probeer morgen opnieuw of voeg credits toe.';
            return;
          }

          if (!r.ok || !j) {
            out.textContent = 'Error: ' + (j && j.error ? j.error : r.status);
            return;
          }
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
  } );
} );

/* ---------------- v2 iframe shortcode (load include file) ---------------- */
if ( file_exists( plugin_dir_path( __FILE__ ) . 'includes/shortcode-v2-iframe.php' ) ) {
  require_once plugin_dir_path( __FILE__ ) . 'includes/shortcode-v2-iframe.php';
}

/* ---------------- Flatsome UX Builder element (guarded) ---------------- */
add_action( 'init', function () {
  if ( function_exists( 'add_ux_builder_shortcode' ) ) {
    add_ux_builder_shortcode( 'etsy_ai_generator', [
      'name'      => __( 'Etsy AI Generator (legacy)', 'etsy-ai-listing' ),
      'category'  => __( 'Content', 'etsy-ai-listing' ),
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
} );

package com.labguard.security;

import com.labguard.entity.User;
import com.labguard.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Service;

import java.util.Collections;

@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new UsernameNotFoundException("User not found with email: " + email));

        if (!user.getIsActive()) {
            throw new DisabledException("Account has been disabled by Administrator");
        }

        // Exact Spring Security Authority: ROLE_ADMIN, ROLE_FACULTY, ROLE_LAB_ASSISTANT, ROLE_STUDENT
        String roleName = "ROLE_" + user.getRole().getName();
        return new org.springframework.security.core.userdetails.User(
            user.getEmail(),
            user.getPasswordHash(),
            user.getIsActive(),
            true, true, true,
            Collections.singletonList(new SimpleGrantedAuthority(roleName))
        );
    }
}
